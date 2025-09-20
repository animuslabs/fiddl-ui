<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import { useQuasar, LocalStorage } from "quasar"
import { Dialog } from "quasar"
import { useRouter } from "vue-router"
import { img, s3Video } from "lib/netlifyImg"
import { usePopularityStore } from "src/stores/popularityStore"
import { useUserAuth } from "src/stores/userAuth"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { isOwned } from "lib/ownedMediaCache"
import LikeMedia from "src/components/dialogs/LikeMedia.vue"
import type { MediaType } from "lib/types"
import { creationsSetRequestPrivacy, creationsDeleteRequest, creationsDeleteMedia } from "lib/orval"
import { prices } from "stores/pricesStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"

export interface MediaGalleryMeta {
  id: string
  url?: string
  aspectRatio?: number
  // Preferred field used by this component
  type?: "image" | "video"
  // Back-compat for API objects that provide `mediaType`
  mediaType?: "image" | "video"
  requestId?: string
  requestType?: "image" | "video"
  isPublic?: boolean
  requestQuantity?: number
  placeholder?: boolean
}

const props = withDefaults(
  defineProps<{
    mediaObjects: MediaGalleryMeta[]
    layout?: "grid" | "mosaic"
    colsDesktop?: number
    colsMobile?: number
    gap?: number | string
    thumbSizeDesktop?: number
    thumbSizeMobile?: number
    selectable?: boolean
    // IDs marked as selected (for external multi-select UIs)
    selectedIds?: string[]
    rowHeightRatio?: number
    showLoading?: boolean
    centerAlign?: boolean
    showPopularity?: boolean
    showVisibilityToggle?: boolean
    showDeleteButton?: boolean
  }>(),
  {
    layout: "grid",
    colsDesktop: 4,
    colsMobile: 2,
    gap: "8px",
    thumbSizeDesktop: 200,
    thumbSizeMobile: 120,
    selectable: false,
    selectedIds: undefined,
    rowHeightRatio: 1.2,
    showLoading: true,
    centerAlign: false,
    showPopularity: false,
    showVisibilityToggle: false,
    showDeleteButton: false,
  },
)

// Loading and reload keys for media; keys are added only when item mounts/visible
const videoLoading = ref<Record<string, boolean>>({})
const videoReloadKey = ref<Record<string, number>>({})
const imageLoading = ref<Record<string, boolean>>({})
const imageReloadKey = ref<Record<string, number>>({})

// Intersection-based visibility map to unmount offscreen media
const visibleMap = ref<Record<string, boolean>>({})
type ObserveBinding = string // media id

// Preload/unmount buffer around viewport to avoid thrash
const OBSERVER_ROOT_MARGIN = "800px"

// Local directive to observe an element and toggle visibility for its media id
let sharedIO: IntersectionObserver | null = null
const ioTargets = new Map<Element, string>()
function getSharedIO(): IntersectionObserver {
  if (sharedIO) return sharedIO
  sharedIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = ioTargets.get(entry.target)
        if (!id) continue
        visibleMap.value[id] = entry.isIntersecting
      }
    },
    { root: null, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 },
  )
  return sharedIO
}
const vObserve: import("vue").Directive<HTMLElement, ObserveBinding> = {
  mounted(el, binding) {
    const id = binding.value
    if (!id) return
    ioTargets.set(el, id)
    getSharedIO().observe(el)
  },
  unmounted(el, binding) {
    const id = binding.value
    if (id) delete visibleMap.value[id]
    ioTargets.delete(el)
    if (sharedIO) sharedIO.unobserve(el)
  },
}

const emit = defineEmits<{
  (e: "select", payload: { id: string; type: "image" | "video" }): void
  (e: "selectedIndex", index: number): void
}>()

const $q = useQuasar()
const userAuth = useUserAuth()
const mediaViewerStore = useMediaViewerStore()
const router = useRouter()
const isMobile = computed(() => $q.screen.lt.md)
const cols = computed(() => {
  if ($q.screen.lt.md) return props.colsMobile
  return props.colsDesktop
})
const thumbSize = computed(() => (isMobile.value ? props.thumbSizeMobile : props.thumbSizeDesktop))
const gapValue = computed(() => (typeof props.gap === "number" ? `${props.gap}px` : props.gap))
const popularity = usePopularityStore()
const popIconSize = ref("8px")

const imageCreations = useImageCreations()
const videoCreations = useVideoCreations()
const privacyLoading = ref<Record<string, boolean>>({})
const deleteLoading = ref<Record<string, boolean>>({})

/**
 * Popularity polling (use setTimeout loop to avoid overlap; pause when tab hidden)
 * Note: using a timeout loop prevents stacking requests when the network is slow.
 */
const pollIntervalMs = 30000
let popularityPollTimer: number | null = null

// Video reload retry timer (moved from global setInterval)
let videoReloadTimer: number | null = null

// Ephemeral "+N" burst UI for upvotes
type UpvoteBurst = { count: number; visible: boolean; timer?: number }
const upvoteBursts = ref<Record<string, UpvoteBurst>>({})

function onUpvote(id: string, type: MediaType) {
  if (!userAuth.loggedIn) {
    Dialog.create({
      title: "Login required",
      message: "You get free upvotes each day, but you need to login first.",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void router.push({ name: "login" })
    })
    return
  }
  triggerUpvoteBurst(id)
  void popularity.addUpvote(id, type)
}

function triggerUpvoteBurst(id: string) {
  const cur = upvoteBursts.value[id] || { count: 0, visible: false }
  const next: UpvoteBurst = { ...cur, count: cur.count + 1, visible: true }
  if (next.timer) window.clearTimeout(next.timer)
  next.timer = window.setTimeout(() => {
    // hide and reset count after a short delay
    upvoteBursts.value[id] = { count: 0, visible: false }
  }, 1800) as unknown as number
  upvoteBursts.value[id] = next
}

function ownsMediaQuick(id: string, type: MediaType): boolean {
  if (isOwned(id, type)) return true
  if (type === "video") {
    if (mediaViewerStore.hdVideoUrl[id]) return true
    const cached = LocalStorage.getItem<string>("hdVideoUrl-" + id)
    if (cached) return true
  } else {
    if (mediaViewerStore.hdImageSrc[id]) return true
  }
  return false
}

function onFavorite(id: string, type: MediaType) {
  if (!userAuth.loggedIn) {
    Dialog.create({
      title: "Login required",
      message: "You need to login to like media",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void router.push({ name: "login" })
    })
    return
  }

  const isFav = !!popularity.get(id)?.isFavoritedByMe
  // Unfavorite path: allow immediately
  if (isFav) {
    void popularity.toggleFavorite(id, type)
    return
  }

  // Favorite path: gate instantly if not unlocked
  if (!ownsMediaQuick(id, type)) {
    Dialog.create({
      component: LikeMedia,
      componentProps: { type, userOwnsMedia: false, currentMediaId: id },
    }).onOk(() => {
      void popularity.toggleFavorite(id, type)
    })
    return
  }

  // User owns/unlocked -> proceed
  void popularity.toggleFavorite(id, type)
}

const wrapperStyles = computed(() => {
  const isMosaic = props.layout === "mosaic"
  const base: Record<string, string> = {
    display: "grid",
    gap: gapValue.value,
    width: "100%",
  }

  if (isMosaic && props.centerAlign) {
    base.gridTemplateColumns = `repeat(${cols.value}, ${thumbSize.value}px)`
    base.gridAutoRows = `${thumbSize.value * props.rowHeightRatio}px`
    base.gridAutoFlow = "dense"
    base.justifyContent = "center"
  } else {
    // Revert to fluid columns that shrink to fit container to avoid overflow at tablet sizes
    base.gridTemplateColumns = `repeat(${cols.value}, 1fr)`
    if (isMosaic) {
      base.gridAutoRows = `${thumbSize.value * props.rowHeightRatio}px`
      base.gridAutoFlow = "dense"
    }
  }

  return base
})

// Fast lookup for selection state
const selectedSet = computed(() => new Set(props.selectedIds || []))

const mediaStyles = computed(() => {
  const style =
    props.layout === "grid"
      ? {
          height: "100%",
          width: "100%",
          // maxHeight: "100px",
          aspectRatio: "1 / 1",
          "object-fit": "cover",
          display: "block",
        }
      : {
          width: "100%",
          height: "100%",
          "object-fit": "cover",
          display: "block",
        }

  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")
})

const galleryItems = ref<MediaGalleryMeta[]>([])

// Sticky placeholder support to keep loading tiles visible even if upstream removes them too early
const stickyPendingMap = ref<Record<string, MediaGalleryMeta & { addedAt: number }>>({})
const stickyOrder = ref<string[]>([])
const prevRealIds = ref<Set<string>>(new Set())
const prevPlaceholderIds = ref<Set<string>>(new Set())

const filteredGalleryItems = computed(() => {
  // const list = props.showLoading ? galleryItems.value : galleryItems.value.filter((el) => videoLoading.value[el.id])
  // console.log(list)
  return galleryItems.value
})

watch(
  () => props.mediaObjects,
  (val) => {
    void buildItems(val)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.layout,
  () => {
    void buildItems(props.mediaObjects)
  },
)

async function buildItems(src: MediaGalleryMeta[]) {
  // IMPORTANT: avoid preloading image/video metadata for offscreen items to keep memory low.
  // We only compute aspect ratio from existing data; otherwise fall back to 1 until media loads.
  const normalized = src.map((item) => {
    const incomingType = ((item.mediaType ?? item.type) as string | undefined)?.toString().toLowerCase()
    if (!item.url) item.url = incomingType === "video" ? s3Video(item.id, "preview-lg") : img(item.id, "lg")
    const derived = (incomingType as "image" | "video" | undefined) ?? getMediaType(item.url)
    const type: "image" | "video" = derived === "video" ? "video" : "image"
    const isPlaceholder = item.placeholder === true || (typeof item.id === "string" && item.id.startsWith("pending-"))
    const fallbackAspect = type === "video" ? 16 / 9 : 1
    const aspectRatio = props.layout === "grid" ? 1 : isPlaceholder ? 1.6 : item.aspectRatio ?? fallbackAspect
    return { ...item, type, aspectRatio }
  })

  // Helper predicates
  const isPlaceholderId = (id: string | undefined) => typeof id === "string" && id.startsWith("pending-")
  const isPlaceholderItem = (it: MediaGalleryMeta) => it.placeholder === true || isPlaceholderId(it.id as any)

  // Current placeholder and real id sets
  const placeholderIdsNow = new Set(normalized.filter((i) => isPlaceholderItem(i)).map((i) => i.id))
  const realIdsNow = new Set(normalized.filter((i) => !isPlaceholderItem(i) && i.type !== "video").map((i) => i.id))

  // Detect placeholders that disappeared upstream (likely because the store removed them early)
  const disappeared = Array.from(prevPlaceholderIds.value).filter((id) => !placeholderIdsNow.has(id))
  const now = Date.now()
  for (const id of disappeared) {
    if (!stickyPendingMap.value[id]) {
      // Recreate a minimal placeholder tile so the user sees continued loading feedback
      stickyPendingMap.value[id] = {
        id,
        url: img(id, "lg"),
        type: "image",
        placeholder: true,
        aspectRatio: props.layout === "grid" ? 1 : 1.6,
        addedAt: now,
      } as any
      stickyOrder.value.push(id)
    }
  }

  // Count newly-arrived real images since last render to release stickies 1:1
  let newlyArrived = 0
  for (const id of realIdsNow) {
    if (!prevRealIds.value.has(id)) newlyArrived++
  }

  // Drop that many sticky placeholders (FIFO)
  while (newlyArrived > 0 && stickyOrder.value.length) {
    const dropId = stickyOrder.value.shift()!
    delete stickyPendingMap.value[dropId]
    newlyArrived--
  }

  // Build final list: include sticky placeholders only if not already provided upstream
  const upstreamIds = new Set(normalized.map((i) => i.id))
  const stickyList = stickyOrder.value
    .filter((id) => !upstreamIds.has(id))
    .map((id) => stickyPendingMap.value[id])
    .filter(Boolean) as MediaGalleryMeta[]

  galleryItems.value = [...stickyList, ...normalized]

  // Update snapshots for next build
  prevRealIds.value = realIdsNow
  prevPlaceholderIds.value = placeholderIdsNow

  if (props.showPopularity) {
    const items = galleryItems.value.map((i) => ({
      id: i.id,
      mediaType: i.type === "video" ? "video" : ("image" as MediaType),
    }))
    // Load from cache/network for anything missing; store dedupes requests
    void popularity.fetchBatchByItems(items)
  }
}

function getMediaType(url: string): "image" | "video" {
  return url.match(/\.(mp4|webm|ogg)(\?.*)?$/i) ? "video" : "image"
}

// We no longer pre-measure assets offscreen; ratios are updated opportunistically on load

function markVideoLoadStart(id: string) {
  videoLoading.value[id] = true
}

function markVideoLoaded(id: string) {
  const el = document.querySelector(`video[data-id="${id}"]`) as HTMLVideoElement | null
  if (!el) return

  // Only mark as loaded if we have metadata and some readiness
  if (el.readyState >= 2) {
    // Use explicit false to indicate "done loading" so template checks can
    // reliably hide the overlay and show the video element.
    videoLoading.value[id] = false

    if (el.videoWidth && el.videoHeight) {
      const realAspect = el.videoWidth / el.videoHeight
      const item = galleryItems.value.find((i) => i.id === id)
      if (item) item.aspectRatio = realAspect
    }
  }
}

function markVideoErrored(id: string) {
  videoLoading.value[id] = true
}

function markImageLoaded(id: string) {
  imageLoading.value[id] = false
  const im = document.querySelector(`img[data-id="${id}"]`) as HTMLImageElement | null
  if (im && im.naturalWidth && im.naturalHeight) {
    const realAspect = im.naturalWidth / im.naturalHeight
    const item = galleryItems.value.find((i) => i.id === id)
    if (item) item.aspectRatio = realAspect
  }
}

function markImageErrored(id: string) {
  // Keep in loading state and allow periodic reload attempts
  imageLoading.value[id] = true
}

function canTogglePrivacy(item: MediaGalleryMeta): boolean {
  return props.showVisibilityToggle && !!item.requestId && item.placeholder !== true
}

function canDelete(item: MediaGalleryMeta): boolean {
  return !!props.showDeleteButton && item.placeholder !== true
}

function updateStoreRequestPublic(requestId: string, requestType: "image" | "video", value: boolean) {
  const stores = requestType === "image" ? [imageCreations] : [videoCreations]
  for (const store of stores) {
    const creation = store.creations.find((c) => c.id === requestId)
    if (creation) creation.public = value
  }
}

function updateLocalItemsPublic(requestId: string, value: boolean) {
  for (const item of galleryItems.value) {
    if (item.requestId === requestId) item.isPublic = value
  }
}

function handleVisibilityClick(item: MediaGalleryMeta) {
  if (!canTogglePrivacy(item) || !item.requestId) return
  const currentPublic = item.isPublic !== false
  const nextPublic = !currentPublic
  const requestType = (item.requestType || item.type || "image") as "image" | "video"
  const requestId = item.requestId
  const quantity = item.requestQuantity ?? 1
  const taxPer = prices.privateTax ?? 0
  const totalTax = !nextPublic ? taxPer * quantity : 0
  const message = nextPublic ? "Make this creation public? It will appear in the community feed." : taxPer > 0 ? `Make this creation private? This costs ${totalTax} points (${taxPer} per item).` : "Make this creation private?"

  Dialog.create({
    title: nextPublic ? "Share creation publicly?" : "Make creation private?",
    message,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      privacyLoading.value[requestId] = true
      await creationsSetRequestPrivacy({
        public: nextPublic,
        imageRequestId: requestType === "image" ? requestId : undefined,
        videoRequestId: requestType === "video" ? requestId : undefined,
      })
      updateStoreRequestPublic(requestId, requestType, nextPublic)
      updateLocalItemsPublic(requestId, nextPublic)
      item.isPublic = nextPublic
      $q.notify({
        type: "positive",
        message: nextPublic ? "Creation is now public." : "Creation set to private.",
      })
    } catch (err) {
      console.error("Failed to toggle privacy", err)
      $q.notify({ type: "negative", message: "Unable to update visibility. Please try again." })
    } finally {
      privacyLoading.value[requestId] = false
    }
  })
}

function handleDeleteClick(item: MediaGalleryMeta) {
  Dialog.create({
    title: "Delete Creation",
    message: "Are you sure you want to delete this creation?",
    ok: { label: "Delete", color: "negative" },
    cancel: { label: "Cancel", color: "primary" },
    persistent: true,
  }).onOk(async () => {
    try {
      deleteLoading.value[item.id] = true
      await creationsDeleteMedia(item.type === "video" ? { videoId: item.id } : { imageId: item.id })

      // Remove from local gallery
      galleryItems.value = galleryItems.value.filter((i) => i.id !== item.id)

      // Update stores so other views stay in sync
      if (item.type === "image") {
        const creation = imageCreations.creations.find((c) => c.mediaIds.includes(item.id))
        if (creation) imageCreations.deleteImage(item.id, creation.id)
      } else {
        const creation = videoCreations.creations.find((c) => c.mediaIds.includes(item.id))
        if (creation) videoCreations.deleteVideo(item.id, creation.id)
      }

      $q.notify({ type: "positive", message: "Deleted" })
    } catch (err) {
      console.error("Failed to delete media", err)
      $q.notify({ type: "negative", message: "Unable to delete. Please try again." })
    } finally {
      delete deleteLoading.value[item.id]
    }
  })
}

function getItemStyle(m: MediaGalleryMeta): Record<string, string | number | undefined> {
  if (props.layout !== "mosaic") return {}
  const aspect = m.aspectRatio ?? 1
  const isPlaceholder = m.placeholder === true || (typeof m.id === "string" && m.id.startsWith("pending-"))
  const videoPending = m.type === "video" && showVideoOverlay(m.id)
  const treatAsPlaceholder = isPlaceholder || videoPending
  const layoutAspect = treatAsPlaceholder ? Math.max(aspect, 1.6) : aspect
  const baseSpan = layoutAspect > 1.5 && cols.value > 1 ? 2 : undefined
  const colSpan = treatAsPlaceholder && cols.value > 1 ? Math.min(2, cols.value) : baseSpan

  // When an item spans multiple columns, also increase its vertical span proportionally
  // so wide media aren’t visually cropped. We scale rows by the number of columns taken.
  const colFactor = colSpan ?? 1
  const rows = Math.max(1, Math.ceil((colFactor / layoutAspect) * props.rowHeightRatio))

  return {
    gridRowEnd: `span ${rows}`,
    gridColumnEnd: colSpan ? `span ${colSpan}` : undefined,
  }
}

/**
 * Popularity polling and video reload retry setup
 */

// Compose items payload for popularity store
function getPopularityItems(): { id: string; mediaType: "image" | "video" }[] {
  return galleryItems.value.map((i) => ({
    id: i.id,
    mediaType: i.type === "video" ? "video" : ("image" as MediaType),
  }))
}

// Track previous set of IDs to trigger an immediate refresh for new items
const prevIdSet = ref<Set<string>>(new Set())

function startPopularityPolling() {
  stopPopularityPolling()
  const run = async () => {
    if (!props.showPopularity) return
    if (typeof document !== "undefined" && document.hidden) {
      popularityPollTimer = window.setTimeout(run, pollIntervalMs) as unknown as number
      return
    }
    const items = getPopularityItems()
    if (items.length === 0) {
      popularityPollTimer = window.setTimeout(run, pollIntervalMs) as unknown as number
      return
    }
    try {
      // Only refresh missing/stale entries to limit network and avoid overlap
      await popularity.refreshStaleByItems(items, { ttlMs: 120000, max: 200 })
    } finally {
      popularityPollTimer = window.setTimeout(run, pollIntervalMs) as unknown as number
    }
  }
  void run()
}

function stopPopularityPolling() {
  if (popularityPollTimer) {
    window.clearTimeout(popularityPollTimer)
    popularityPollTimer = null
  }
}

// Start/stop polling based on prop
watch(
  () => props.showPopularity,
  (enabled) => {
    if (enabled) startPopularityPolling()
    else stopPopularityPolling()
  },
  { immediate: true },
)

// Refresh per-user fields when auth state changes
watch(
  () => userAuth.loggedIn,
  () => {
    if (props.showPopularity) void popularity.refreshBatchByItems(getPopularityItems())
  },
)

// When gallery content changes, ensure any missing popularity entries are fetched
watch(
  () => galleryItems.value.map((i) => i.id).join(","),
  () => {
    if (!props.showPopularity) return
    // Always request popularity for any missing entries (fast cache path)
    void popularity.fetchBatchByItems(getPopularityItems())

    // Additionally, force a fresh server refresh for only newly-appearing items
    const currentIds = galleryItems.value.map((i) => i.id)
    const newIds = currentIds.filter((id) => !prevIdSet.value.has(id))
    if (newIds.length) {
      const newItems = galleryItems.value.filter((i) => newIds.includes(i.id)).map((i) => ({ id: i.id, mediaType: i.type === "video" ? "video" : ("image" as MediaType) }))
      void popularity.refreshBatchByItems(newItems)
    }
    // Update the snapshot of IDs
    prevIdSet.value = new Set(currentIds)
  },
)

onMounted(() => {
  // Move retry loop to lifecycle and clean up on unmount
  videoReloadTimer = window.setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return
    // Retry videos that aren't ready yet
    for (const id of Object.keys(videoLoading.value)) {
      if (videoLoading.value[id]) {
        // Only nudge reload for visible videos
        if (visibleMap.value[id]) videoReloadKey.value[id] = Date.now()
      }
    }
    // Retry images only when the loading UI is enabled
    if (props.showLoading) {
      for (const id of Object.keys(imageLoading.value)) {
        if (imageLoading.value[id]) {
          if (visibleMap.value[id]) imageReloadKey.value[id] = Date.now()
        }
      }
    }
  }, 10000) as unknown as number
})

onUnmounted(() => {
  if (videoReloadTimer) window.clearInterval(videoReloadTimer)
  stopPopularityPolling()
})

function isVideoMedia(m: MediaGalleryMeta): boolean {
  const url = m.url || ""
  const t = m.type ?? getMediaType(url)
  return t === "video"
}

function videoClass(media: MediaGalleryMeta) {
  return {
    "cursor-pointer": props.selectable && videoLoading.value[media.id] === false,
  }
}

function isVisible(id: string): boolean {
  return !!visibleMap.value[id]
}

function showImageOverlay(id: string): boolean {
  // Always cover placeholder tiles so users see progress, even if loading UI is disabled elsewhere
  const item = galleryItems.value.find((i) => i.id === id)
  const isPending = (typeof id === "string" && id.startsWith("pending-")) || item?.placeholder === true
  if (isPending) return true

  if (!props.showLoading) return false

  // treat undefined as loading=true so overlay shows until first load
  return imageLoading.value[id] !== false
}

function showVideoOverlay(id: string): boolean {
  const item = galleryItems.value.find((i) => i.id === id)
  const isPending = (typeof id === "string" && id.startsWith("pending-")) || item?.placeholder === true
  if (isPending) return true

  const state = videoLoading.value[id]
  if (!props.showLoading) return state === true || state === undefined

  return state !== false
}
</script>

<template lang="pug">
.full-width(:style="wrapperStyles")
  div(
    v-for="(m, index) in filteredGalleryItems"
    :key="m.id"
    :style="getItemStyle(m)"
    :class="{ 'media-cell': true, 'is-selected': props.selectable && selectedSet.has(m.id) }"
    v-observe="m.id"
  )
    template(v-if="!isVideoMedia(m)")
      .media-wrapper(:style="mediaStyles")
        // Only mount heavy content when visible
        template(v-if="isVisible(m.id)")
          // Loading overlay for images that are still rendering/propagating
          div.loading-overlay(v-if="showImageOverlay(m.id)")
            h4 Loading
            q-spinner-gears(color="grey-10" size="120px")
          // Actual image (rendered underneath the overlay)
          q-img(
            :src="m.url"
            :key="imageReloadKey[m.id]"
            position="top"
            style="width:100%; height:100%; object-fit: cover; object-position: top; display:block"
            spinner-color="white"
            :class="props.selectable ? 'cursor-pointer' : ''"
            :img-attrs="{ 'data-id': m.id }"
            @load="markImageLoaded(m.id)"
            @error="markImageErrored(m.id)"
            @click="emit('select', { id: m.id, type: 'image' }); emit('selectedIndex', index)"
          )
        template(v-else)
          // Placeholder keeps layout without mounting the image element
          div(style="width:100%; height:100%; background: rgba(0,0,0,0.06);")
        q-btn.delete-chip(
          v-if="canDelete(m) && isVisible(m.id)"
          dense
          flat
          round
          color="grey-5"
          icon="delete"
          @click.stop="handleDeleteClick(m)"
          :loading="!!deleteLoading[m.id]"
          :disable="deleteLoading[m.id] === true"
        )
        q-btn.visibility-chip(
          v-if="canTogglePrivacy(m) && isVisible(m.id)"
          dense
          flat
          round
          padding="0"
          color="grey-5"
          :icon="m.isPublic ? 'public' : 'visibility_off'"
          @click.stop="handleVisibilityClick(m)"
          :loading="!!privacyLoading[m.requestId || '']"
          :disable="privacyLoading[m.requestId || ''] === true"
        )
          q-tooltip {{ m.isPublic ? 'Currently public. Click to make private.' : 'Currently private. Click to make public.' }}
        .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
          .hidden-text Hidden
          q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'image')" label="Unhide")
        // Popularity overlay controls
        .popularity-overlay(v-if="props.showPopularity && isVisible(m.id)")
          .pop-row
            q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'image')")
            span.count(v-if="popularity.get(m.id)?.favorites") {{ popularity.get(m.id)?.favorites ?? 0 }}
            .upvote-burst-wrap
              q-btn(:size="popIconSize" flat dense round :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'" @click.stop="onUpvote(m.id, 'image')")
              transition(name="burst")
                .upvote-burst(v-if="upvoteBursts[m.id]?.visible") +{{ upvoteBursts[m.id]?.count || 0 }}
            span.count(v-if="popularity.get(m.id)?.upvotes") {{ popularity.get(m.id)?.upvotes ?? 0 }}
            q-btn( :size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'image')")
        // Per-item actions slot (optional)
        slot(name="actions" :media="m" :index="index")
          // default empty
    template(v-else)
      .media-wrapper(:style="mediaStyles")
        // Only mount heavy content when visible
        template(v-if="isVisible(m.id)")
          div.loading-overlay(v-if="showVideoOverlay(m.id)")
            h4 Loading
            q-spinner-gears(color="grey-10" size="120px")
          div(v-show="!showVideoOverlay(m.id)" style="position: relative; overflow: hidden; width: 100%; height: 100%;")
            video(
              :src="m.url"
              :key="videoReloadKey[m.id]"
              :data-id="m.id"
              loop autoplay muted playsinline
              @loadstart="markVideoLoadStart(m.id)"
              @canplay="markVideoLoaded(m.id)"
              @loadeddata="markVideoLoaded(m.id)"
              @error="markVideoErrored(m.id)"
              @click="emit('select', { id: m.id, type: 'video' }); emit('selectedIndex', index)"
              style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block"
              :class="videoClass(m)"
            )
        template(v-else)
          // Placeholder keeps layout without mounting the video element
          div(style="width:100%; height:100%; background: rgba(0,0,0,0.06);")
        q-btn.delete-chip(
          v-if="canDelete(m) && isVisible(m.id)"
          dense
          flat
          round
          color="grey-5"
          icon="delete"
          @click.stop="handleDeleteClick(m)"
          :loading="!!deleteLoading[m.id]"
          :disable="deleteLoading[m.id] === true"
        )
        q-btn.visibility-chip(
          v-if="canTogglePrivacy(m) && isVisible(m.id)"
          dense
          flat
          round
          :color="m.isPublic ? 'primary' : 'grey-5'"
          :icon="m.isPublic ? 'public' : 'visibility_off'"
          @click.stop="handleVisibilityClick(m)"
          :loading="!!privacyLoading[m.requestId || '']"
          :disable="privacyLoading[m.requestId || ''] === true"
        )
          q-tooltip {{ m.isPublic ? 'Currently public. Click to make private.' : 'Currently private. Click to make public.' }}
        // Hidden overlay - keeps layout stable
        .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
          .hidden-text Hidden
          q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'video')" label="Unhide")
        // Popularity overlay controls
        .popularity-overlay(v-if="props.showPopularity && isVisible(m.id)")
          .pop-row
            q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'video')")
            span.count(v-if="popularity.get(m.id)?.favorites") {{ popularity.get(m.id)?.favorites ?? 0 }}
            .upvote-burst-wrap
              q-btn( :size="popIconSize" flat dense round :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'" @click.stop="onUpvote(m.id, 'video')")
              transition(name="burst")
                .upvote-burst(v-if="upvoteBursts[m.id]?.visible") +{{ upvoteBursts[m.id]?.count || 0 }}
            span.count(v-if="popularity.get(m.id)?.upvotes") {{ popularity.get(m.id)?.upvotes ?? 0 }}
            q-btn( :size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'video')")
        // Per-item actions slot (optional)
        //- slot(name="actions" :media="m" :index="index")
          // default empty
</template>

<style>
.media-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.media-container img,
.media-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-cell {
  position: relative;
}

.media-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  /* Smooth selection feedback */
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.2);
  color: white;
  z-index: 2;
  pointer-events: none;
}
.loading-overlay h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* Selected state: subtle scale + inset highlight */
.media-cell.is-selected .media-wrapper {
  transform: scale(0.965);
  box-shadow: 0 0 0 3px var(--q-secondary) inset;
  border-radius: 6px;
}

/* Explicit selection ring drawn above media content */
.media-cell.is-selected .media-wrapper::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 3px solid var(--q-secondary);
  border-radius: 6px;
  pointer-events: none;
  z-index: 3;
}

.media-wrapper > [slot="actions"],
.media-wrapper ::v-slotted([name="actions"]) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 6px 4px;
  display: flex;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.2), transparent);
  z-index: 2;
  pointer-events: auto;
}

.visibility-chip {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  z-index: 4;
  filter: opacity(0.5);
}

.visibility-chip .q-spinner {
  color: white;
}

.delete-chip {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  z-index: 4;
  filter: opacity(0.5);
}

.delete-chip .q-spinner {
  color: white;
}

/* Lower the absolute-center slightly to appear visually centered within varying thumbnails */
.absolute-center.offset-down {
  top: 58% !important;
}

.popularity-overlay {
  position: absolute;
  bottom: 5px;
  left: 50%;
  background: rgba(0, 0, 0, 0.15);
  transform: translate(-50%, 0);

  color: white;
  border-radius: 12px;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  row-gap: 2px;
  max-width: 80%;
  z-index: 3;
  pointer-events: none;
  backdrop-filter: blur(10px);
  box-sizing: border-box;
}
.popularity-overlay .pop-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.popularity-overlay .count {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}
.popularity-overlay .q-btn,
.popularity-overlay .count {
  pointer-events: auto;
}

.hidden-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  z-index: 4;
  pointer-events: auto;
  text-align: center;
}
.hidden-overlay .hidden-text {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.95;
}
/* Upvote "+N" burst */
.upvote-burst-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.popularity-overlay .upvote-burst-wrap {
  pointer-events: auto;
}
.upvote-burst {
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translate(-50%, 0);
  background: rgba(0, 0, 0, 0.45);
  color: #d68834;
  font-weight: 700;
  font-size: 18px;
  line-height: 1;
  padding: 8px 12px;
  border-radius: 999px;
  pointer-events: none;
  white-space: nowrap;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
}

/* transition for the burst popup */
.burst-enter-active,
.burst-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.burst-enter-from {
  opacity: 0;
  transform: translate(-50%, 6px) scale(0.95);
}
.burst-enter-to {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.burst-leave-from {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.burst-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px) scale(0.98);
}
</style>
