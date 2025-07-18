<script lang="ts" setup>
import { ref, computed, watch } from "vue"
import { useQuasar } from "quasar"

export interface MediaGalleryMeta {
  id: string
  url: string
  aspectRatio?: number
  type?: "image" | "video"
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
  },
)

const videoLoading = ref<Record<string, boolean>>({})
const videoReloadKey = ref<Record<string, number>>({})

const emit = defineEmits<{
  (e: "select", payload: { id: string; type: "image" | "video" }): void
  (e: "selectedIndex", index: number): void
}>()

const $q = useQuasar()
const isMobile = computed(() => $q.screen.lt.md)
const cols = computed(() => {
  if ($q.screen.lt.sm) return 2
  if ($q.screen.lt.md) return 5
  return props.colsDesktop
})
const thumbSize = computed(() => (isMobile.value ? props.thumbSizeMobile : props.thumbSizeDesktop))
const gapValue = computed(() => (typeof props.gap === "number" ? `${props.gap}px` : props.gap))

const wrapperStyles = computed(() => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gap: gapValue.value,
  ...(props.layout === "mosaic"
    ? {
        gridAutoRows: `${thumbSize.value * props.rowHeightRatio}px`,
        gridAutoFlow: "dense",
      }
    : {}),
}))

const mediaStyles = computed(() => {
  const style =
    props.layout === "grid"
      ? {
          height: "100%",
          width: "100%",
          // maxHeight: "100px",
          // maxWidth: "100px",
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
  return {
    gridRowEnd: `span ${Math.ceil((1 / aspect) * props.rowHeightRatio)}`,
    gridColumnEnd: aspect > 1.5 ? "span 2" : undefined,
  }
}

setInterval(() => {
  for (const id of Object.keys(videoLoading.value)) {
    if (videoLoading.value[id]) {
      videoReloadKey.value[id] = Date.now()
    }
  }
}, 10000)

function videoClass(media: MediaGalleryMeta) {
  return {
    "cursor-pointer": props.selectable && !videoLoading[media.id],
    display: videoLoading[media.id] ? "none" : "block",
  }
}
</script>

<template lang="pug">
.full-width(:style="wrapperStyles")
  div(
    v-for="(m, index) in galleryItems"
    :key="m.id"
    :style="getItemStyle(m)"
  )
    q-img(
      v-if="m.type === 'image'"
      :src="m.url"
      :style="mediaStyles"
      spinner-color="white"
      :class="props.selectable ? 'cursor-pointer' : ''"
      @click="emit('select', { id: m.id, type: 'image' }); emit('selectedIndex', index)"
    )
    template(v-else)
      div(v-if="videoLoading[m.id]" :style="mediaStyles" style="position: relative" )
        .full-width.full-height()
          .absolute-center
            h4 Loading
          q-spinner.absolute.full-width.full-height.flex.flex-center(color="white" size="lg")
      div(:style="mediaStyles" style="position: relative; overflow: hidden")
        video(
          :src="m.url"
          :key="videoReloadKey[m.id]"
          :data-id="m.id"
          loop autoplay muted playsinline
          @canplay="markVideoLoaded(m.id)"
          @loadeddata="markVideoLoaded(m.id)"
          @click="emit('select', { id: m.id, type: 'video' }); emit('selectedIndex', index)"
          style="width: 100%; height: 100%; object-fit: cover; display: block"
          :class="videoClass(m)"
        )
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
</style>
