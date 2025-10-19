<template lang="pug">
div
  //- Main media display area
  div.relative-position(
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  )
    transition(name="fade")
      q-linear-progress.absolute-top.full-width.image-darken(
        style="top:-2px;"
        indeterminate
        v-if=" mediaViewerStore.imgLoading || mediaViewerStore.loading || mediaViewerStore.hdVideoLoading"
        color="primary"
        track-color="transparent"
      )

    div(v-if="mediaViewerStore.currentMediaType === 'video'" class="video-wrapper")
      //- Seamless preview->HD: stack two videos and crossfade when HD is buffered
      .video-stack(
        :style="{ maxHeight: viewportHeight(75), aspectRatio: aspectRatio || undefined, transform: `translateX(${mediaViewerStore.touchState.moveX}px)` }"
      )
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
        //- HD layer (fades in when synced)
        video.video-layer.hd(
          v-if="currentHdUrl"
          ref="hdRef"
          :src="currentHdUrl"
          playsinline
          loop
          :muted="hdMuted"
          :controls="showHd"
          :class="{ visible: showHd }"
          @loadedmetadata="onHdMetadata"
          @volumechange="onVolumeChange"
          @click.stop="onMediaClick"
        )

    img(
      v-else
      v-bind="imageAttrs"
      ref="imageRef"
    )

    .absolute-top.full-width(style="width:100vw")
      .centered(v-if="mediaViewerStore.hdVideoLoading")
        h6.text-white HD Loading
  .centered.q-mt-md(v-if="showCreatorInfo")
    .q-pa-sm.r-xl.bg-blur(@click.stop)
      CreatorInfo(
        :creatorMeta="mediaViewerStore.creatorMeta"
        usernameClass="text-white q-mr-sm"
        avatarSize="30px"
        wrapperClass=""
      )
  //- .centered.q-mt-md(v-if="showIndicators")
  //-   span.indicator(
  //-     v-for="(media, index) in mediaViewerStore.mediaObjects"
  //-     :key="index"
  //-     :class="{ active: index === mediaViewerStore.currentIndex }"
  //-     @click.stop="mediaViewerStore.goToIndex(index)"
  //-   )
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from "vue"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import CreatorInfo from "src/components/CreatorInfo.vue"
import { img, s3Video } from "src/lib/netlifyImg"
import { isOwned } from "lib/ownedMediaCache"
import { viewportHeight } from "src/lib/viewport"
interface Props {
  downloadMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  downloadMode: false,
})
const mediaViewerStore = useMediaViewerStore()

// Load muted preference on initialization
mediaViewerStore.loadMutedPreference()
const currentHdUrl = computed(() => mediaViewerStore.hdVideoUrl[mediaViewerStore.currentMediaId])

// Refs for layered videos and image
const previewRef = ref<HTMLVideoElement | null>(null)
const hdRef = ref<HTMLVideoElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

// Derived urls
const previewVideoUrl = computed(() => s3Video(mediaViewerStore.currentMediaId, "preview-lg"))

// Aspect ratio lock for container (prevents size pop)
const aspectRatio = ref<string | null>(null)

// Crossfade control
const showHd = ref(false)

// Muting strategy: preview follows store until switch; HD starts muted then adopts store on switch
const previewMuted = computed(() => mediaViewerStore.muted)
const hdMuted = computed(() => (showHd.value ? mediaViewerStore.muted : true))

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

onBeforeUnmount(() => {
  cancelSyncLoop()
  mediaViewerStore.registerVideoElement(null)
})

const showCreatorInfo = computed(() => mediaViewerStore.creatorMeta.userName.length > 0)

const showIndicators = computed(() => mediaViewerStore.mediaObjects.length > 1 && !props.downloadMode && mediaViewerStore.mediaObjects.length < 11)

const imageAttrs = computed(() => {
  const base = {
    class: mediaClass.value,
    style: {
      width: "100%",
      "max-height": viewportHeight(75),
      "object-fit": "contain",
      transform: `translateX(${mediaViewerStore.touchState.moveX}px)`,
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

const mediaClass = computed(() => {
  // Before the first image ever loads, avoid dimming but animate blur.
  if (!mediaViewerStore.firstImageLoaded) return "image-darken blur-anim-only"

  // While loading (initial or during navigation), dim and animate blur.
  const isLoading = mediaViewerStore.loading || mediaViewerStore.imgLoading
  return isLoading ? "image-darken active blur-anim-dim" : "image-darken"
})

async function onMediaLoaded(event?: Event) {
  const isImage = mediaViewerStore.currentMediaType === "image"

  // Instant ownership from local cache
  if (isOwned(mediaViewerStore.currentMediaId, mediaViewerStore.currentMediaType)) {
    mediaViewerStore.userOwnsMedia = true
  }

  if (isImage && event) {
    const imgEl = event.target as HTMLImageElement
    if (imgEl.src.startsWith("data:image/")) {
      mediaViewerStore.hdMediaLoaded = true
    } else if (!mediaViewerStore.triedHdLoad) {
      // Only load HD if not already tried (prevents duplicate calls)
      await mediaViewerStore.loadHdMedia()
    }
  } else if (!isImage && !mediaViewerStore.hdMediaLoaded && !mediaViewerStore.triedHdLoad) {
    // Only load HD if not already tried (prevents duplicate calls)
    await mediaViewerStore.loadHdMedia()
  }

  mediaViewerStore.onMediaLoaded()

  // Preload and load metadata on first load only
  if (!mediaViewerStore.firstImageLoaded) {
    preloadMedia()
    // Only load request ID if not already loaded
    if (!mediaViewerStore.loadedRequestId) {
      await mediaViewerStore.loadRequestId()
    }
  }
}

// Keep HD buffered and synced behind the preview; when ready, crossfade
function onPreviewMetadata(e: Event) {
  const v = e.target as HTMLVideoElement
  if (v && v.videoWidth && v.videoHeight) {
    aspectRatio.value = `${v.videoWidth} / ${v.videoHeight}`
  }
  void v.play().catch(() => {})
}

function onHdMetadata(e: Event) {
  const hd = e.target as HTMLVideoElement
  const preview = previewRef.value
  if (!hd || !preview) return
  try {
    hd.currentTime = preview.currentTime || 0
  } catch {}
  void hd.play().catch(() => {})
  requestNextFrameSync()
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
      const url = isVideo
        ? mediaViewerStore.hdVideoUrl[mediaObj.id] || s3Video(mediaObj.id, "preview-lg")
        : mediaViewerStore.hdImageSrc[mediaObj.id] || mediaViewerStore.lgImageSrc[mediaObj.id] || img(mediaObj.id, "lg")
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
    if (!newId || !oldId) return // Skip initial load (handled by parent)

    // Reset states for new media
    mediaViewerStore.hdVideoLoading = false
    mediaViewerStore.hdMediaLoaded = false
    mediaViewerStore.triedHdLoad = false
    mediaViewerStore.userLikedMedia = false
    mediaViewerStore.userOwnsMedia = isOwned(newId, mediaViewerStore.currentMediaType)

    // Reset creator info for new media
    mediaViewerStore.creatorMeta = { userName: "", id: "" }
    mediaViewerStore.loadedRequestId = null

    // Reset local crossfade state and aspect ratio
    showHd.value = false
    aspectRatio.value = null
    cancelSyncLoop()

    // Check like status and load HD media only for navigation between media
    await Promise.allSettled([
      mediaViewerStore.checkUserLikedMedia(),
      mediaViewerStore.loadLgImage(),
      mediaViewerStore.loadHdMedia(),
      mediaViewerStore.loadRequestId(),
    ])
  },
  { immediate: false },
)
</script>

<style scoped>
.fade-enter-active {
  transition: opacity 0.5s ease 0.5s;
}
.fade-enter {
  opacity: 0;
}
.fade-enter-to {
  opacity: 1;
}
.image-darken {
  background-color: transparent;
  color: transparent;
  /* Keep transform smooth; filter animation is handled via keyframes */
  transition: transform 0.3s ease;
  will-change: transform;
}
.image-darken.hd-loaded {
  transform: scale(1.01);
}
.image-darken.active {
  /* Fallback/static filter while not animating */
  filter: blur(3px) brightness(50%) saturate(50%);
}

/* Blur-out animations
   - blur-anim-only: only animates blur from 5px to 0px (no dimming)
   - blur-anim-dim: animates blur while keeping dimming constant */
@keyframes mv-blur-out-only {
  0% {
    filter: blur(5px);
  }
  100% {
    filter: blur(0);
  }
}

@keyframes mv-blur-out-dim {
  0% {
    filter: blur(5px) brightness(50%) saturate(50%);
  }
  100% {
    filter: blur(0) brightness(50%) saturate(50%);
  }
}

.blur-anim-only {
  animation: mv-blur-out-only 3s ease-out forwards;
}

.blur-anim-dim {
  animation: mv-blur-out-dim 3s ease-out forwards;
}

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .blur-anim-only,
  .blur-anim-dim {
    animation: none;
  }
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
  max-height: 75vh;
  max-height: 75dvh;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.video-stack {
  position: relative;
  width: 100%;
  max-width: 100vw;
  height: auto;
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
.video-layer.preview { opacity: 1; }
.video-layer.hd { opacity: 0; }
.video-layer.hd.visible { opacity: 1; }
</style>
