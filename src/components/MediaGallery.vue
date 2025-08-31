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

export interface MediaGalleryMeta {
  id: string
  url?: string
  aspectRatio?: number
  type?: "image" | "video"
  // Optional privacy flag. If explicitly false, treat as private.
  // When undefined, privacy is unknown and click handlers will fall back to error messaging on denial.
  isPublic?: boolean
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
    rowHeightRatio?: number
    showLoading?: boolean
    centerAlign?: boolean
    showPopularity?: boolean
  }>(),
  {
    layout: "grid",
    colsDesktop: 4,
    colsMobile: 2,
    gap: "8px",
    thumbSizeDesktop: 200,
    thumbSizeMobile: 120,
    selectable: false,
    rowHeightRatio: 1.2,
    showLoading: true,
    centerAlign: false,
    showPopularity: false,
  },
)

const videoLoading = ref<Record<string, boolean>>({})
const videoReloadKey = ref<Record<string, number>>({})

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

// Popularity polling
const pollIntervalMs = 15000
let popularityPollTimer: number | null = null

// Video reload retry timer (moved from global setInterval)
let videoReloadTimer: number | null = null

// Ephemeral "+N" burst UI for upvotes
type UpvoteBurst = { count: number; visible: boolean; timer?: number }
const upvoteBursts = ref<Record<string, UpvoteBurst>>({})

function onUpvote(id: string, type: MediaType, isPublic?: boolean) {
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
  // If we explicitly know the media is private, block with a friendly message
  if (isPublic === false) {
    Dialog.create({
      title: "Private Media",
      message: "This media is private and cannot be upvoted.",
      ok: { label: "OK", flat: true, color: "primary" },
    })
    return
  }

  triggerUpvoteBurst(id)
  // If privacy is unknown, proceed but handle potential server rejection gracefully
  void (async () => {
    try {
      await popularity.addUpvote(id, type)
    } catch (e) {
      Dialog.create({
        title: "Unable to Upvote",
        message: "This media may be private and cannot be upvoted.",
        ok: { label: "OK", flat: true, color: "primary" },
      })
    }
  })()
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
  galleryItems.value = await Promise.all(
    src.map(async (item) => {
      if (!item.url) item.url = item.type === "video" ? s3Video(item.id, "preview-lg") : img(item.id, "lg")
      const type = item.type ?? getMediaType(item.url)
      if (type === "video" && !videoLoading.value[item.id]) {
        const videoEl = document.querySelector(`video[data-id="${item.id}"]`) as HTMLVideoElement | null
        if (!videoEl || videoEl.readyState < 2) {
          videoLoading.value[item.id] = true
        }
      }

      const aspectRatio = props.layout === "grid" ? 1 : (item.aspectRatio ?? (type === "image" ? await getImageAspectRatio(item.url) : await getVideoAspectRatio(item.url)))

      return { ...item, type, aspectRatio }
    }),
  )
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

async function getImageAspectRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1)
    img.onerror = () => resolve(1)
    img.src = url
  })
}

async function getVideoAspectRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.onloadedmetadata = () => resolve(video.videoWidth / video.videoHeight || 1)
    video.onerror = () => resolve(1)
    video.src = url
  })
}

function markVideoLoaded(id: string) {
  const el = document.querySelector(`video[data-id="${id}"]`) as HTMLVideoElement | null
  if (!el) return

  // Only mark as loaded if we have metadata and some readiness
  if (el.readyState >= 2) {
    delete videoLoading.value[id]

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

function getItemStyle(m: MediaGalleryMeta): Record<string, string | number | undefined> {
  if (props.layout !== "mosaic") return {}
  const aspect = m.aspectRatio ?? 1
  const colSpan = aspect > 1.5 && cols.value > 1 ? 2 : undefined

  // When an item spans multiple columns, also increase its vertical span proportionally
  // so wide media aren’t visually cropped. We scale rows by the number of columns taken.
  const colFactor = colSpan ?? 1
  const rows = Math.max(1, Math.ceil((colFactor / aspect) * props.rowHeightRatio))

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
  // Immediate refresh to ensure per-user fields (isFavoritedByMe/isUpvotedByMe) are current
  void popularity.refreshBatchByItems(getPopularityItems())
  popularityPollTimer = window.setInterval(() => {
    void popularity.refreshBatchByItems(getPopularityItems())
  }, pollIntervalMs) as unknown as number
}

function stopPopularityPolling() {
  if (popularityPollTimer) {
    window.clearInterval(popularityPollTimer)
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
      const newItems = galleryItems.value
        .filter((i) => newIds.includes(i.id))
        .map((i) => ({ id: i.id, mediaType: i.type === "video" ? "video" : ("image" as MediaType) }))
      void popularity.refreshBatchByItems(newItems)
    }
    // Update the snapshot of IDs
    prevIdSet.value = new Set(currentIds)
  },
)

onMounted(() => {
  // Move retry loop to lifecycle and clean up on unmount
  videoReloadTimer = window.setInterval(() => {
    for (const id of Object.keys(videoLoading.value)) {
      if (videoLoading.value[id]) {
        videoReloadKey.value[id] = Date.now()
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
    "cursor-pointer": props.selectable && !videoLoading.value[media.id],
  }
}
</script>

<template lang="pug">
.full-width(:style="wrapperStyles")
  div(
    v-for="(m, index) in filteredGalleryItems"
    :key="m.id"
    :style="getItemStyle(m)"
    class="media-cell"
  )
    template(v-if="!isVideoMedia(m)")
      .media-wrapper(:style="mediaStyles")
        q-img(
          :src="m.url"
          position="top"
          style="width:100%; height:100%; object-fit: cover; object-position: top; display:block"
          spinner-color="white"
          :class="props.selectable ? 'cursor-pointer' : ''"
          @click="emit('select', { id: m.id, type: 'image' }); emit('selectedIndex', index)"
        )
        .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
          .hidden-text Hidden
          q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'image')" label="Unhide")
        // Popularity overlay controls
        .popularity-overlay(v-if="props.showPopularity")
          .pop-row
            q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'image')")
            span.count(v-if="popularity.get(m.id)?.favorites") {{ popularity.get(m.id)?.favorites ?? 0 }}
            .upvote-burst-wrap
              q-btn(
                v-if="m.isPublic !== false"
                :size="popIconSize"
                flat dense round
                :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'"
                @click.stop="onUpvote(m.id, 'image', m.isPublic)"
              )
              transition(name="burst")
                .upvote-burst(v-if="upvoteBursts[m.id]?.visible") +{{ upvoteBursts[m.id]?.count || 0 }}
            span.count(v-if="popularity.get(m.id)?.upvotes") {{ popularity.get(m.id)?.upvotes ?? 0 }}
            q-btn( :size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'image')")
        // Per-item actions slot (optional)
        slot(name="actions" :media="m" :index="index")
          // default empty
    template(v-else)
      .media-wrapper(:style="mediaStyles")
        div(v-if="props.showLoading && videoLoading[m.id]" style="position: relative;" ).full-height
          div
            .absolute-center.z-top.offset-down
              h4 Loading
            q-spinner-gears.absolute-center.offset-down(color="grey-10" size="150px")
        //- div {{ !!videoLoading[m.id] }}
        div(v-show="!videoLoading[m.id]" style="position: relative; overflow: hidden; width: 100%; height: 100%;")
          video(
            :src="m.url"
            :key="videoReloadKey[m.id]"
            :data-id="m.id"
            loop autoplay muted playsinline
            @canplay="markVideoLoaded(m.id)"
            @loadeddata="markVideoLoaded(m.id)"
            @click="emit('select', { id: m.id, type: 'video' }); emit('selectedIndex', index)"
            style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block"
            :class="videoClass(m)"
          )
        // Hidden overlay - keeps layout stable
        .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
          .hidden-text Hidden
          q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'video')" label="Unhide")
        // Popularity overlay controls
        .popularity-overlay(v-if="props.showPopularity")
          .pop-row
            q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'video')")
            span.count(v-if="popularity.get(m.id)?.favorites") {{ popularity.get(m.id)?.favorites ?? 0 }}
            .upvote-burst-wrap
              q-btn(
                v-if="m.isPublic !== false"
                :size="popIconSize"
                flat dense round
                :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'"
                @click.stop="onUpvote(m.id, 'video', m.isPublic)"
              )
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
