<template lang="pug">
MediaViewerControls(
  :key="controlsKey"
  :allowDelete="allowDelete"
  :downloadMode="downloadMode"
  :initialCommentId="initialCommentId"
  :mediaWidth="mediaWidth"
  @close="handleClose"
)
  div.viewer-root(@click.stop)
    //- Main media display area
    div.relative-position.full-width(
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    )
      transition(name="fade")
        .absolute-top.full-width.loading-indicator-container(
          v-if="showLoadingIndicator"
          role="status"
          aria-label="Loading additional media"
        )
          span.loading-indicator-circle

      div(v-if="mediaViewerStore.currentMediaType === 'video'" class="video-wrapper")
        //- Seamless preview->LG/HD: stack preview-sm under lg/hd and crossfade
        .video-stack(
          ref="mediaStageRef"
          :style="videoStageStyle"
        )
          div.video-placeholder(v-if="showVideoPlaceholder" :style="videoPlaceholderStyle" @click.stop="onMediaClick")
            div.video-placeholder-overlay
              q-icon(name="play_arrow" size="48px" color="white")
              span.video-placeholder-spinner
          //- Preview layer (controls until HD is visible)
          video.video-layer.preview(
            ref="previewRef"
            :src="previewVideoUrl"
            playsinline
            autoplay
            loop
            :muted="previewMuted"
            :controls="!showHd"
            @canplay="onMediaLoaded"
            @loadedmetadata="onPreviewMetadata"
            @timeupdate="onPreviewTimeUpdate"
            @volumechange="onVolumeChange"
            @click.stop="onMediaClick"
          )
          //- Visible overlay while a higher-quality layer is loading (preview visible)
          div.hd-loading-overlay(
            v-if="showHdLoadingOverlay"
            role="status"
            aria-live="polite"
            aria-label="Loading HD video"
          )
            span.hd-loading-text Loading HD
          //- HD layer (fades in when synced)
          video.video-layer.hd(
            v-if="hdCandidateUrl"
            ref="hdRef"
            :src="hdCandidateUrl"
            playsinline
            loop
            :muted="hdMuted"
            :controls="showHd"
            :class="{ visible: showHd }"
            @loadedmetadata="onHdMetadata"
            @volumechange="onVolumeChange"
            @click.stop="onMediaClick"
          )

      // Image path mirrors video wrapper so preview fills same area
      div(
        v-else
        ref="mediaStageRef"
        :class="imageWrapperClass"
        :style="[touchMoveStyle, imageBackdropStyle, imageStageStyle]"
      )
        img(
          v-bind="imageAttrs"
          ref="imageRef"
        )


</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount, onMounted } from "vue"
import { useQuasar } from "quasar"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import MediaViewerControls from "./MediaViewerControls.vue"
import { img, s3Video } from "src/lib/netlifyImg"
import { isOwned } from "lib/ownedMediaCache"
import { viewportHeight } from "src/lib/viewport"
import { getCachedAspectRatio, parseAspectRatio, rememberAspectRatio } from "src/lib/aspectRatio"
interface Props {
  downloadMode?: boolean
  allowDelete?: boolean
  initialCommentId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  downloadMode: false,
  allowDelete: true,
  initialCommentId: null,
})
const emit = defineEmits<{
  close: []
}>()
const mediaViewerStore = useMediaViewerStore()
const $q = useQuasar()

const MAX_FRAME_WIDTH = 1100
const MIN_FRAME_WIDTH = 320
const MIN_STAGE_SIZE = 300
const FRAME_MAX_WIDTH_CSS = `min(95vw, ${MAX_FRAME_WIDTH}px)`

function handleClose() {
  emit("close")
}

// Load muted preference on initialization
mediaViewerStore.loadMutedPreference()
const currentHdUrl = computed(() => mediaViewerStore.hdVideoUrl[mediaViewerStore.currentMediaId])

// Refs for layered videos and image
const previewRef = ref<HTMLVideoElement | null>(null)
const hdRef = ref<HTMLVideoElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const mediaStageRef = ref<HTMLElement | null>(null)
const mediaWidth = ref(0)
const controlsKey = ref(0)
let stageObserver: ResizeObserver | null = null
const naturalDimensions = ref<{ width: number; height: number }>({ width: 0, height: 0 })
const displayDimensions = ref<{ width: number; height: number }>({ width: 0, height: 0 })
const WIDTH_STABLE_FRAMES = 2
const widthCache = new Map<string, number>()
const currentMediaId = computed(() => mediaViewerStore.currentMediaId)
let lastMeasuredWidth = 0
let stableMeasuredFrames = 0

function resetWidthTracking() {
  lastMeasuredWidth = 0
  stableMeasuredFrames = 0
}

function cacheCommittedWidth(width: number) {
  const id = currentMediaId.value
  if (!id) return
  widthCache.set(id, width)
}

function commitFrameWidth(width: number, source: "expected" | "measured" = "measured") {
  if (!Number.isFinite(width) || width <= 0) return
  const normalized = Math.max(1, Math.round(width))

  if (source === "expected") {
    mediaWidth.value = normalized
    cacheCommittedWidth(normalized)
    lastMeasuredWidth = normalized
    stableMeasuredFrames = WIDTH_STABLE_FRAMES
    return
  }

  const expected = displayDimensions.value.width
  if (expected > 0) {
    const expectedNormalized = Math.max(1, Math.round(expected))
    const expectedTolerance = Math.max(2, expectedNormalized * 0.01)
    if (Math.abs(width - expected) <= expectedTolerance) {
      mediaWidth.value = expectedNormalized
      cacheCommittedWidth(expectedNormalized)
      lastMeasuredWidth = expectedNormalized
      stableMeasuredFrames = WIDTH_STABLE_FRAMES
      return
    }
  }

  const tolerance = Math.max(2, normalized * 0.02)
  if (Math.abs(normalized - lastMeasuredWidth) <= tolerance) {
    stableMeasuredFrames += 1
  } else {
    stableMeasuredFrames = 1
  }
  lastMeasuredWidth = normalized

  if (stableMeasuredFrames >= WIDTH_STABLE_FRAMES || mediaWidth.value <= 0) {
    mediaWidth.value = normalized
    cacheCommittedWidth(normalized)
  }
}

const previewReady = ref(false)
const heightClampedToViewport = ref(false)
const METADATA_RETRY_LIMIT = 5
const METADATA_RETRY_DELAY_MS = 120
let metadataRetryHandle: number | null = null
const MEASUREMENT_RETRY_LIMIT = 12
const MEASUREMENT_RETRY_DELAY_MS = 60
const BURST_MEASUREMENT_FRAMES = 8
const INITIAL_MEASUREMENT_FRAMES = 14
let measurementRetryHandle: number | null = null
let measurementRetryAttempts = 0
let measurementRaf: number | null = null
let burstMeasurementsRemaining = 0
let forcedRecalcTimer: number | null = null
const frameMaxWidth = computed(() => {
  const available = Math.max(MIN_FRAME_WIDTH, $q.screen.width - 32)
  return Math.min(available, MAX_FRAME_WIDTH)
})
let removeViewportResizeListeners: (() => void) | null = null
const currentMedia = computed(() => mediaViewerStore.mediaObjects[mediaViewerStore.currentIndex] ?? null)
let cancelAspectPrime: (() => void) | null = null

const stageHeight = computed(() => viewportHeight(75))
const touchMoveStyle = computed(() => ({
  transform: `translateX(${mediaViewerStore.touchState.moveX}px)`,
}))
const stageSizeStyle = computed(() => {
  const style: Record<string, string> = {
    maxHeight: stageHeight.value,
    maxWidth: FRAME_MAX_WIDTH_CSS,
    margin: "0 auto",
  }
  const width = displayDimensions.value.width
  style.width = `${width > 0 ? width : frameMaxWidth.value}px`
  return style
})
const imageStageStyle = computed(() => {
  const style: Record<string, string> = {
    ...stageSizeStyle.value,
  }
  if (aspectRatio.value) {
    style.aspectRatio = aspectRatio.value
  } else if (displayDimensions.value.height > 0) {
    style.height = heightClampedToViewport.value ? stageHeight.value : `${displayDimensions.value.height}px`
  } else {
    style.height = stageHeight.value
  }
  return style
})
const videoStageStyle = computed(() => {
  const style: Record<string, string> = {
    ...stageSizeStyle.value,
    transform: `translateX(${mediaViewerStore.touchState.moveX}px)`,
    overflow: "hidden",
  }
  style.minWidth = `${Math.min(frameMaxWidth.value, MIN_STAGE_SIZE)}px`
  style.minHeight = `${MIN_STAGE_SIZE}px`
  if (aspectRatio.value) {
    style.aspectRatio = aspectRatio.value
  } else if (displayDimensions.value.height > 0) {
    style.height = heightClampedToViewport.value ? stageHeight.value : `${displayDimensions.value.height}px`
  } else {
    style.height = stageHeight.value
  }
  return style
})
const basePreviewUrl = computed(() => {
  if (mediaViewerStore.currentMediaType !== "image") return ""
  const id = mediaViewerStore.currentMediaId
  return id ? img(id, "sm") : ""
})
const videoThumbnailUrl = computed(() => {
  if (mediaViewerStore.currentMediaType !== "video") return ""
  const id = mediaViewerStore.currentMediaId
  return id ? s3Video(id, "thumbnail") : ""
})
const imageBackdropStyle = computed(() => {
  const url = basePreviewUrl.value
  if (!url) {
    return {
      background: "none",
      backgroundColor: "transparent",
    } as Record<string, string>
  }
  return {
    backgroundImage: `url('${url}')`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundColor: "transparent",
  } as Record<string, string>
})

// Derived urls
// Use the fastest preview first for responsiveness
const previewVideoUrl = computed(() => s3Video(mediaViewerStore.currentMediaId, "preview-sm"))
// Promote to HD when available, otherwise LG preview
const hdCandidateUrl = computed(() => currentHdUrl.value || s3Video(mediaViewerStore.currentMediaId, "preview-lg"))

// Aspect ratio lock for container (prevents size pop)
const aspectRatio = ref<string | null>(null)
const aspectRatioNum = ref<number | null>(null)

// Crossfade control
const showHd = ref(false)

// Muting strategy: preview follows store until switch; HD starts muted then adopts store on switch
const previewMuted = computed(() => mediaViewerStore.muted)
const hdMuted = computed(() => (showHd.value ? mediaViewerStore.muted : true))

const showVideoPlaceholder = computed(() => mediaViewerStore.currentMediaType === "video" && !previewReady.value)
const videoPlaceholderStyle = computed(() => {
  const url = videoThumbnailUrl.value
  if (!url) {
    return {
      background: "radial-gradient(circle at center, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.65) 100%)",
      backgroundColor: "#1e1e1e",
    } as Record<string, string>
  }
  return {
    backgroundImage: `url('${url}')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "#1e1e1e",
  } as Record<string, string>
})

// Show HD overlay while preview is active and HD/LG layer hasn't taken over yet
const showHdLoadingOverlay = computed(() => {
  if (mediaViewerStore.currentMediaType !== "video") return false
  if (mediaViewerStore.rateLimitActive) return false
  // When preview is ready but HD/LG hasn't crossfaded in yet
  return previewReady.value && !showHd.value
})

// Register currently active video with store for external controls
function syncActiveVideoElement() {
  void nextTick(() => {
    const active = showHd.value ? hdRef.value : previewRef.value
    if (mediaViewerStore.currentMediaType === "video" && active instanceof HTMLVideoElement) {
      mediaViewerStore.registerVideoElement(active)
    } else {
      mediaViewerStore.registerVideoElement(null)
    }
  })
}

function clearMetadataRetry() {
  if (metadataRetryHandle !== null) {
    window.clearTimeout(metadataRetryHandle)
    metadataRetryHandle = null
  }
}

function applyVideoDimensions(width: number, height: number): boolean {
  if (!width || !height) return false
  previewReady.value = true
  aspectRatio.value = `${width} / ${height}`
  aspectRatioNum.value = width / height
  rememberAspectRatio(mediaViewerStore.currentMediaId, aspectRatioNum.value)
  updateNaturalDimensions(width, height)
  return true
}

function captureVideoDimensionsFrom(video: HTMLVideoElement | null): boolean {
  if (!video) return false
  const width = Math.round(video.videoWidth || 0)
  const height = Math.round(video.videoHeight || 0)
  return applyVideoDimensions(width, height)
}

function ensureVideoDimensions(video: HTMLVideoElement | null, attempt = 0): void {
  if (!video) return
  if (captureVideoDimensionsFrom(video)) {
    clearMetadataRetry()
    scheduleStageMeasurement()
    return
  }
  if (attempt >= METADATA_RETRY_LIMIT) return
  clearMetadataRetry()
  const delay = METADATA_RETRY_DELAY_MS * (attempt + 1)
  metadataRetryHandle = window.setTimeout(() => {
    ensureVideoDimensions(video, attempt + 1)
  }, delay)
}

watch(
  () => [mediaViewerStore.currentMediaType, showHd.value],
  () => {
    syncActiveVideoElement()
  },
  { immediate: true },
)

watch(
  () => [previewRef.value, hdRef.value],
  () => {
    syncActiveVideoElement()
  },
)

// Loading dot: delay for images so it shows only after 500ms
const LOADING_DOT_DELAY_MS = 500
const showImmediateIndicator = computed(
  () =>
    mediaViewerStore.loading ||
    mediaViewerStore.hdVideoLoading ||
    mediaViewerStore.rateLimitActive ||
    (mediaViewerStore.currentMediaType !== "image" && mediaViewerStore.imgLoading),
)
const watchingImageLoading = computed(() => mediaViewerStore.currentMediaType === "image" && mediaViewerStore.imgLoading)
const showImageLoadingDelayed = ref(false)
let imgLoadingTimer: number | null = null

watch(
  watchingImageLoading,
  (active) => {
    if (active) {
      if (imgLoadingTimer != null) return
      imgLoadingTimer = window.setTimeout(() => {
        imgLoadingTimer = null
        if (watchingImageLoading.value) showImageLoadingDelayed.value = true
      }, LOADING_DOT_DELAY_MS)
    } else {
      if (imgLoadingTimer != null) {
        clearTimeout(imgLoadingTimer)
        imgLoadingTimer = null
      }
      showImageLoadingDelayed.value = false
    }
  },
  { immediate: true },
)

const showLoadingIndicator = computed(() => showImmediateIndicator.value || showImageLoadingDelayed.value)

onBeforeUnmount(() => {
  if (imgLoadingTimer !== null) {
    clearTimeout(imgLoadingTimer)
    imgLoadingTimer = null
  }
})

const imageWrapperClass = computed(() => ["image-wrapper"])

const imageAttrs = computed(() => {
  const base = {
    class: "image-static",
    style: {
      // Fill area; image sizing handled by wrapper CSS
      "max-height": viewportHeight(75),
      "max-width": "100%",
      width: "100%",
      "object-fit": "contain",
      "background-color": "transparent",
      "background-image": "none",
    } as Record<string, string>,
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      onMediaClick(e)
    },
  }

  return {
    ...base,
    src: mediaViewerStore.getCurrentMediaUrl(),
    onLoad: (e: Event) => onMediaLoaded(e),
    alt: "user created image",
  }
})

async function onMediaLoaded(event?: Event) {
  const target = event?.target as HTMLImageElement | HTMLVideoElement | null
  const isImageEvent = target instanceof HTMLImageElement
  const isVideoEvent = target instanceof HTMLVideoElement
  const currentType = mediaViewerStore.currentMediaType
  const isTypeMatch = (isImageEvent && currentType === "image") || (isVideoEvent && currentType === "video") || (!event && currentType === "image")
  const initialLoad = !mediaViewerStore.firstImageLoaded
  if (event && !isTypeMatch) return

  // Instant ownership from local cache
  if (isOwned(mediaViewerStore.currentMediaId, mediaViewerStore.currentMediaType)) {
    mediaViewerStore.userOwnsMedia = true
  }

  if (isImageEvent) {
    const imgEl = target
    if (!imgEl) return
    if (imgEl.naturalWidth && imgEl.naturalHeight) {
      updateNaturalDimensions(imgEl.naturalWidth, imgEl.naturalHeight)
    }
    if (imgEl.src.startsWith("data:image/")) {
      mediaViewerStore.hdMediaLoaded = true
    } else if (!mediaViewerStore.triedHdLoad) {
      // Only load HD if not already tried (prevents duplicate calls)
      await mediaViewerStore.loadHdMedia()
    }
  } else if (isVideoEvent && !mediaViewerStore.hdMediaLoaded && !mediaViewerStore.triedHdLoad) {
    // Only load HD if not already tried (prevents duplicate calls)
    await mediaViewerStore.loadHdMedia()
  }
  if (isVideoEvent) {
    ensureVideoDimensions((target as HTMLVideoElement | null) ?? previewRef.value)
  }

  mediaViewerStore.onMediaLoaded(mediaViewerStore.currentMediaId)

  // Preload and load metadata on first load only
  if (initialLoad) {
    preloadMedia()
    // Only load request ID if not already loaded
    if (!mediaViewerStore.loadedRequestId) {
      await mediaViewerStore.loadRequestId()
    }
  }
  scheduleStageMeasurement()
}

// Keep HD buffered and synced behind the preview; when ready, crossfade
function onPreviewMetadata(e: Event) {
  const v = (e.target as HTMLVideoElement) ?? null
  ensureVideoDimensions(v)
  void v?.play().catch(() => {})
  scheduleStageMeasurement()
}

function onHdMetadata(e: Event) {
  const hd = (e.target as HTMLVideoElement) ?? null
  const preview = previewRef.value
  if (!hd || !preview) return
  ensureVideoDimensions(hd)
  try {
    hd.currentTime = preview.currentTime || 0
  } catch {}
  void hd.play().catch(() => {})
  requestNextFrameSync()
  scheduleStageMeasurement()
}

let syncRaf: number | null = null
function cancelSyncLoop() {
  if (syncRaf != null) {
    cancelAnimationFrame(syncRaf)
    syncRaf = null
  }
}

function requestNextFrameSync() {
  cancelSyncLoop()
  syncRaf = requestAnimationFrame(syncAndMaybeSwap)
}

function syncAndMaybeSwap() {
  const hd = hdRef.value
  const preview = previewRef.value
  if (!hd || !preview || showHd.value) return
  const dt = Math.abs((hd.currentTime || 0) - (preview.currentTime || 0))
  if (dt > 0.25) {
    try {
      hd.currentTime = preview.currentTime
    } catch {}
    requestNextFrameSync()
    return
  }
  if (hd.readyState >= 3) {
    try {
      preview.muted = true
    } catch {}
    showHd.value = true
    scheduleStageMeasurement()
    window.setTimeout(() => {
      try {
        preview.pause()
      } catch {}
      syncActiveVideoElement()
    }, 180)
  } else {
    requestNextFrameSync()
  }
}

function onPreviewTimeUpdate() {
  if (showHd.value) return
  const hd = hdRef.value
  const preview = previewRef.value
  if (!hd || !preview) return
  const dt = Math.abs((hd.currentTime || 0) - (preview.currentTime || 0))
  if (dt > 0.25) {
    try {
      hd.currentTime = preview.currentTime
    } catch {}
  }
}

function preloadMedia() {
  const preloadIndices = [mediaViewerStore.currentIndex - 1, mediaViewerStore.currentIndex + 1]
  preloadIndices.forEach((index) => {
    if (index >= 0 && index < mediaViewerStore.mediaObjects.length) {
      const mediaObj = mediaViewerStore.mediaObjects[index]
      if (!mediaObj) return
      const isVideo = mediaObj.type === "video"
      const url = isVideo ? mediaViewerStore.hdVideoUrl[mediaObj.id] || s3Video(mediaObj.id, "preview-lg") : mediaViewerStore.hdImageSrc[mediaObj.id] || mediaViewerStore.lgImageSrc[mediaObj.id] || img(mediaObj.id, "lg")
      if (isVideo) {
        const video = document.createElement("video")
        video.preload = "auto"
        video.src = url
        video.load()
      } else {
        const imgElement = new Image()
        imgElement.src = url
      }
    }
  })
}

function onMediaClick(event: MouseEvent) {
  if (mediaViewerStore.rateLimitActive) return
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const width = rect.width

  if (clickX < width / 2) {
    mediaViewerStore.prevMedia()
  } else {
    mediaViewerStore.nextMedia()
  }
}

function onVolumeChange(event: Event) {
  const videoEl = event.target as HTMLVideoElement
  mediaViewerStore.setMuted(videoEl.muted)
}

function handleTouchStart(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  mediaViewerStore.handleTouchStart(e.changedTouches[0].clientX)
}

function handleTouchMove(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  mediaViewerStore.handleTouchMove(e.changedTouches[0].clientX)
}

function handleTouchEnd(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  mediaViewerStore.handleTouchEnd()
}

// Watch for current media changes to update HD loading and creator info
watch(
  () => mediaViewerStore.currentMediaId,
  async (newId, oldId) => {
    if (!newId) return
    cancelPendingAspectPrime()
    resetWidthTracking()
    clearMetadataRetry()
    resetMeasurementRetry()
    previewReady.value = false
    const cachedWidth = widthCache.get(newId)
    if (cachedWidth && cachedWidth > 0) {
      mediaWidth.value = cachedWidth
      lastMeasuredWidth = cachedWidth
      stableMeasuredFrames = WIDTH_STABLE_FRAMES
    } else if (!oldId) {
      mediaWidth.value = 0
    }
    naturalDimensions.value = { width: 0, height: 0 }
    displayDimensions.value = { width: 0, height: 0 }
    primeDimensionsFromMetadata(currentMedia.value)
    // Immediately compute a fallback frame so bars align while we load
    recalculateDisplayDimensions()
    primeAspectRatioForCurrentMedia()

    if (!oldId) {
      scheduleStageMeasurement()
      if (typeof window !== 'undefined') {
        if (forcedRecalcTimer != null) window.clearTimeout(forcedRecalcTimer)
        forcedRecalcTimer = window.setTimeout(() => {
          forcedRecalcTimer = null
          recalculateDisplayDimensions()
          scheduleStageMeasurement(BURST_MEASUREMENT_FRAMES * 2, true)
          controlsKey.value += 1
        }, 500)
      }
      return // Skip initial load (handled by parent)
    }

    // Reset states for new media
    mediaViewerStore.hdVideoLoading = false
    mediaViewerStore.hdMediaLoaded = false
    mediaViewerStore.triedHdLoad = false
    mediaViewerStore.userLikedMedia = false
    mediaViewerStore.userOwnsMedia = isOwned(newId, mediaViewerStore.currentMediaType)
    mediaViewerStore.hydrateMetaFromCurrentMedia()

    // Reset local crossfade state and aspect ratio
    showHd.value = false
    aspectRatio.value = null
    aspectRatioNum.value = null
    cancelSyncLoop()

    // Check like status and load HD media only for navigation between media
    await Promise.allSettled([mediaViewerStore.checkUserLikedMedia(), mediaViewerStore.loadLgImage(), mediaViewerStore.loadHdMedia(), mediaViewerStore.loadRequestId()])
    scheduleStageMeasurement()
  },
  { immediate: true },
)

function resetMeasurementRetry() {
  if (measurementRetryHandle !== null) {
    window.clearTimeout(measurementRetryHandle)
    measurementRetryHandle = null
  }
  if (measurementRaf !== null) {
    cancelAnimationFrame(measurementRaf)
    measurementRaf = null
  }
  burstMeasurementsRemaining = 0
  measurementRetryAttempts = 0
}

function scheduleStageMeasurement(frames = BURST_MEASUREMENT_FRAMES, resetRetry = true) {
  if (resetRetry) resetMeasurementRetry()
  burstMeasurementsRemaining = Math.max(burstMeasurementsRemaining, Math.max(1, frames))
  runStageMeasurement()
}

function runStageMeasurement() {
  if (measurementRaf !== null) return
  void nextTick(() => {
    const scheduleNextFrame = () => {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        measurementRaf = window.requestAnimationFrame(step)
      } else {
        step()
      }
    }

    const step = () => {
      measurementRaf = null
      const width = updateStageWidth()
      if (shouldRetryMeasurement(width)) {
        queueMeasurementRetry()
      } else {
        measurementRetryAttempts = 0
        measurementRetryHandle = null
      }

      if (burstMeasurementsRemaining > 0) {
        burstMeasurementsRemaining -= 1
        scheduleNextFrame()
      }
    }

    scheduleNextFrame()
  })
}

function queueMeasurementRetry() {
  if (measurementRetryAttempts >= MEASUREMENT_RETRY_LIMIT) {
    measurementRetryHandle = null
    return
  }
  const delay = MEASUREMENT_RETRY_DELAY_MS * (measurementRetryAttempts + 1)
  measurementRetryAttempts += 1
  measurementRetryHandle = window.setTimeout(() => {
    measurementRetryHandle = null
    burstMeasurementsRemaining = Math.max(burstMeasurementsRemaining, BURST_MEASUREMENT_FRAMES)
    runStageMeasurement()
  }, delay)
}

function shouldRetryMeasurement(measuredWidth: number): boolean {
  if (measurementRetryAttempts >= MEASUREMENT_RETRY_LIMIT) return false
  if (measuredWidth <= 0) return true

  const expectedWidth = displayDimensions.value.width > 0 ? displayDimensions.value.width : frameMaxWidth.value
  if (expectedWidth <= 0) return false

  const tolerance = Math.max(2, expectedWidth * 0.015)
  return Math.abs(expectedWidth - measuredWidth) > tolerance
}

function updateStageWidth(rect?: DOMRectReadOnly | null): number {
  let width = displayDimensions.value.width
  if (mediaViewerStore.currentMediaType === "image" && imageRef.value) {
    width = imageRef.value.getBoundingClientRect().width
  } else if (mediaViewerStore.currentMediaType === "video") {
    const active = showHd.value ? hdRef.value : previewRef.value
    width = (active && active.getBoundingClientRect().width) || 0
  }
  if (!width) {
    width = rect?.width ?? mediaStageRef.value?.getBoundingClientRect().width ?? 0
  }
  if (width > 0) {
    commitFrameWidth(width, "measured")
  }
  return width
}

onMounted(() => {
  if (typeof window !== "undefined") {
    const handleViewportResize = () => {
      recalculateDisplayDimensions()
      scheduleStageMeasurement()
    }
    window.addEventListener("resize", handleViewportResize)
    const visualViewport = window.visualViewport
    visualViewport?.addEventListener("resize", handleViewportResize)
    removeViewportResizeListeners = () => {
      window.removeEventListener("resize", handleViewportResize)
      visualViewport?.removeEventListener("resize", handleViewportResize)
      removeViewportResizeListeners = null
    }
  }
  if (typeof ResizeObserver === "undefined") return
  stageObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    updateStageWidth(entry.contentRect)
  })
  if (mediaStageRef.value) stageObserver.observe(mediaStageRef.value)
  // Ensure we draw an initial fallback frame (square) even when
  // metadata is missing and before the image onload fires.
  recalculateDisplayDimensions()
  primeAspectRatioForCurrentMedia()
  // Force a late recalc ~0.5s after open to mirror
  // the successful reflow that happens after navigation.
  if (typeof window !== 'undefined') {
    if (forcedRecalcTimer != null) window.clearTimeout(forcedRecalcTimer)
    forcedRecalcTimer = window.setTimeout(() => {
      forcedRecalcTimer = null
      recalculateDisplayDimensions()
      scheduleStageMeasurement(BURST_MEASUREMENT_FRAMES * 2, true)
      controlsKey.value += 1
    }, 500)
  }
})

watch(
  () => mediaStageRef.value,
  (current, previous) => {
    if (typeof ResizeObserver === "undefined") return
    if (!stageObserver) {
      stageObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        updateStageWidth(entry.contentRect)
      })
    }
    if (previous) stageObserver.unobserve(previous)
    if (current) stageObserver.observe(current)
    scheduleStageMeasurement()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  cancelSyncLoop()
  mediaViewerStore.registerVideoElement(null)
  clearMetadataRetry()
  resetMeasurementRetry()
  cancelPendingAspectPrime()
  if (typeof window !== 'undefined' && forcedRecalcTimer != null) {
    window.clearTimeout(forcedRecalcTimer)
    forcedRecalcTimer = null
  }
  if (removeViewportResizeListeners) {
    removeViewportResizeListeners()
  }
  if (stageObserver) {
    stageObserver.disconnect()
    stageObserver = null
  }
  if (typeof window !== 'undefined' && forcedRecalcTimer != null) {
    window.clearTimeout(forcedRecalcTimer)
    forcedRecalcTimer = null
  }
})

function updateNaturalDimensions(width: number, height: number) {
  if (!width || !height) return
  naturalDimensions.value = { width, height }
  // Lock aspect ratio on first measurement for images so md->lg->hd swaps don't reflow
  if (!aspectRatioNum.value) {
    aspectRatioNum.value = width / height
    aspectRatio.value = `${width} / ${height}`
    rememberAspectRatio(mediaViewerStore.currentMediaId, aspectRatioNum.value)
  }
  recalculateDisplayDimensions()
}

function cancelPendingAspectPrime() {
  if (cancelAspectPrime) {
    cancelAspectPrime()
    cancelAspectPrime = null
  }
}

function primeAspectRatioForCurrentMedia() {
  cancelPendingAspectPrime()
  if (mediaViewerStore.currentMediaType !== "image") return
  if (aspectRatioNum.value && aspectRatioNum.value > 0) return
  if (typeof window === "undefined") return
  const id = mediaViewerStore.currentMediaId
  if (!id) return
  const cached = getCachedAspectRatio(id)
  if (typeof cached === "number" && cached > 0) {
    primeDimensionsFromMetadata({ id, aspectRatio: cached })
    return
  }
  const src = mediaViewerStore.getCurrentMediaUrl()
  if (!src) return
  let cancelled = false
  const probe = new Image()
  probe.decoding = "async"
  const finalize = () => {
    if (cancelled) return
    cancelAspectPrime = null
    if (probe.naturalWidth && probe.naturalHeight) {
      updateNaturalDimensions(probe.naturalWidth, probe.naturalHeight)
    }
  }
  probe.onload = finalize
  probe.onerror = () => {
    if (cancelled) return
    cancelAspectPrime = null
  }
  cancelAspectPrime = () => {
    cancelled = true
    probe.onload = null
    probe.onerror = null
  }
  probe.src = src
  if (typeof (probe as HTMLImageElement & { decode?: () => Promise<void> }).decode === "function") {
    void (probe as HTMLImageElement & { decode: () => Promise<void> })
      .decode()
      .then(finalize)
      .catch(() => {
        /* ignore decode failure; rely on events */
      })
  }
}

function recalculateDisplayDimensions() {
  const { width, height } = naturalDimensions.value
  if (typeof window === "undefined") {
    if (aspectRatioNum.value) {
      const ratio = Math.max(0.0001, aspectRatioNum.value)
      const baseH = 1000
      const baseW = Math.round(baseH * ratio)
      displayDimensions.value = { width: baseW, height: baseH }
      commitFrameWidth(baseW, "expected")
      heightClampedToViewport.value = false
      return
    }
    if (!width || !height) return
    displayDimensions.value = { width, height }
    commitFrameWidth(width, "expected")
    heightClampedToViewport.value = false
    return
  }
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const maxHeight = Math.max(0, Math.round(viewportHeight * 0.75))
  const maxWidth = frameMaxWidth.value

  // Prefer locked aspect ratio when available to keep size stable across src swaps
  if (aspectRatioNum.value) {
    const ratio = Math.max(0.0001, aspectRatioNum.value)
    const widthIfMaxHeight = Math.round(maxHeight * ratio)
    let displayWidth: number
    let displayHeight: number
    if (widthIfMaxHeight > maxWidth) {
      displayWidth = Math.max(1, Math.round(maxWidth))
      displayHeight = Math.max(1, Math.round(displayWidth / ratio))
      heightClampedToViewport.value = false
    } else {
      displayHeight = Math.max(1, Math.round(maxHeight))
      displayWidth = Math.max(1, Math.round(displayHeight * ratio))
      heightClampedToViewport.value = true
    }
    displayDimensions.value = { width: displayWidth, height: displayHeight }
    commitFrameWidth(displayWidth, "expected")
    scheduleStageMeasurement()
    return
  }

  if (!width || !height) {
    const fallbackSize = Math.max(1, Math.round(Math.min(frameMaxWidth.value, maxHeight)))
    displayDimensions.value = { width: fallbackSize, height: fallbackSize }
    commitFrameWidth(fallbackSize, "expected")
    heightClampedToViewport.value = false
    scheduleStageMeasurement()
    return
  }
  const widthScale = maxWidth > 0 && width > 0 ? maxWidth / width : Number.POSITIVE_INFINITY
  const heightScale = maxHeight > 0 && height > 0 ? maxHeight / height : Number.POSITIVE_INFINITY
  const scaleCandidate = Math.min(widthScale, heightScale)
  const scale = Number.isFinite(scaleCandidate) && scaleCandidate > 0 ? scaleCandidate : 1
  const displayWidth = Math.max(1, Math.round(width * scale))
  const displayHeight = Math.max(1, Math.round(height * scale))
  displayDimensions.value = { width: displayWidth, height: displayHeight }
  commitFrameWidth(displayWidth, "expected")
  // If the limiting factor was height, flag so the wrapper uses dvh instead of px
  heightClampedToViewport.value = heightScale <= widthScale
  scheduleStageMeasurement()
}

watch(frameMaxWidth, () => {
  recalculateDisplayDimensions()
})

function primeDimensionsFromMetadata(media: any) {
  const id = (media?.id as string | undefined) ?? mediaViewerStore.currentMediaId
  let aspect: number | undefined
  if (typeof media?.aspectRatio === "number" && media.aspectRatio > 0) {
    aspect = media.aspectRatio
  } else {
    aspect = parseAspectRatio(media?.aspectRatio)
  }
  if (!aspect) {
    aspect = getCachedAspectRatio(id)
  }
  if (!aspect) return
  const baseHeight = 1000
  const baseWidth = Math.max(1, aspect * baseHeight)
  naturalDimensions.value = { width: baseWidth, height: baseHeight }
  aspectRatioNum.value = aspect
  aspectRatio.value = `${baseWidth} / ${baseHeight}`
  rememberAspectRatio(id, aspect)
  recalculateDisplayDimensions()
}
</script>

<style scoped>
/* Ensure the viewer expands to the full width of its flex container */
.viewer-root {
  width: 100%;
  flex: 1 1 100%;
}
.fade-enter-active {
  transition: opacity 0.5s ease 0.5s;
}
.fade-enter {
  opacity: 0;
}
.fade-enter-to {
  opacity: 1;
}
.loading-indicator-container {
  position: absolute;
  left: 0;
  right: 0;
  top: 4px;
  display: flex;
  justify-content: center;
  z-index: 20;
  pointer-events: none;
}
.loading-indicator-circle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
  animation: mv-loading-pulse 1s ease-in-out infinite;
}
@keyframes mv-loading-pulse {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-indicator-circle {
    animation: none;
    opacity: 1;
    transform: scale(1);
  }
}

/* High-contrast flashing overlay for HD loading while preview is active */
.hd-loading-overlay {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 80;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 6px 12px;
  border-radius: 9999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.18);
  animation: mv-flash 1.2s ease-in-out infinite;
}
.hd-loading-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
@keyframes mv-flash {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .hd-loading-overlay {
    animation: none;
    opacity: 1;
  }
}
.image-static {
  background-color: transparent;
  color: transparent;
  will-change: auto;
}

.indicator {
  display: inline-block;
  height: 10px;
  width: 10px;
  margin: 0 5px 0px;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  cursor: pointer;
}
.active {
  background-color: rgba(255, 255, 255, 1);
}

.video-wrapper {
  width: auto;
  max-width: min(95vw, 1100px);
  max-height: 75vh;
  max-height: 75dvh;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  margin: 0 auto;
}
.video-stack {
  position: relative;
  width: 100%;
  max-width: min(95vw, 1100px);
  margin: 0 auto;
  overflow: hidden;
  min-height: 300px;
  min-width: 300px;
}
.video-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 180ms ease-in-out;
}
.video-layer.preview {
  opacity: 1;
}
.video-layer.hd {
  opacity: 0;
}
.video-layer.hd.visible {
  opacity: 1;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}
.video-placeholder-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.65) 100%);
  pointer-events: none;
}
.video-placeholder-spinner {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.35);
  border-top-color: rgba(255, 255, 255, 0.95);
  animation: mv-video-spinner 0.9s linear infinite;
}
@keyframes mv-video-spinner {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Image wrapper to provide consistent viewport area like videos */
.image-wrapper {
  width: auto;
  max-width: min(95vw, 1100px);
  max-height: 75vh;
  max-height: 75dvh;
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.image-wrapper img {
  display: block;
  width: 100%;
  max-width: 100%;
  max-height: 75vh;
  max-height: 75dvh;
  height: auto;
  object-fit: contain;
  margin: 0 auto;
}

</style>
