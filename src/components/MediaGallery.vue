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
const emit = defineEmits<{
  (e: "select", id: string): void
  (e: "selectedIndex", id: number): void
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
          width: `${thumbSize.value}px`,
          height: `${thumbSize.value}px`,
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

async function getVideoAspectRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.onloadedmetadata = () => {
      resolve(video.videoWidth / video.videoHeight || 1)
    }
    video.onerror = () => resolve(1)
    video.src = url
  })
}

function markVideoLoaded(id: string) {
  delete videoLoading.value[id]
  const el = document.querySelector(`video[data-id="${id}"]`) as HTMLVideoElement | null
  if (el && el.videoWidth && el.videoHeight) {
    const realAspect = el.videoWidth / el.videoHeight
    const item = galleryItems.value.find((i) => i.id === id)
    if (item) item.aspectRatio = realAspect
  }
}

function markVideoErrored(id: string) {
  videoLoading.value[id] = true
}

async function buildItems(src: MediaGalleryMeta[]) {
  galleryItems.value = await Promise.all(
    src.map(async (item) => {
      const type = item.type ?? getMediaType(item.url)
      if (type == "video") videoLoading.value[item.id] = true
      const aspectRatio = item.aspectRatio ?? (type === "image" ? await getImageAspectRatio(item.url) : await getVideoAspectRatio(item.url))
      return { ...item, type, aspectRatio }
    }),
  )
}

watch(
  () => props.mediaObjects,
  (val) => {
    void buildItems(val)
  },
  { immediate: true, deep: true },
)

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

function getItemStyle(m: MediaGalleryMeta): Record<string, string | number | undefined> {
  if (props.layout !== "mosaic") return {}
  const aspect = m.aspectRatio ?? 1
  return {
    gridRowEnd: `span ${Math.ceil((1 / aspect) * props.rowHeightRatio)}`,
    gridColumnEnd: aspect > 1.5 ? "span 2" : undefined,
  }
}
const videoReloadKey = ref<Record<string, number>>({})

setInterval(() => {
  for (const id of Object.keys(videoLoading.value)) {
    if (videoLoading.value[id]) {
      videoReloadKey.value[id] = Date.now()
    }
  }
}, 10000)
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
      @click="emit('select', m.id); emit('selectedIndex', index)"
      spinner-color="white"
      :class="props.selectable ? 'cursor-pointer' : ''"
    )
    template(v-else)
      div(:style="mediaStyles" style="position: relative")
        .full-width.full-height(v-if="videoLoading[m.id]")
          .absolute-center
            h4 Loading
          q-spinner.absolute.full-width.full-height.flex.flex-center(color="white" size="lg")
        video( :src="m.url" :style="mediaStyles" :key="videoReloadKey[m.id]" :data-id="m.id" loop autoplay muted playsinline
        @canplay="markVideoLoaded(m.id)"
        @click="emit('select', m.id); emit('selectedIndex', index)"
        :class="props.selectable && !videoLoading[m.id]? 'cursor-pointer' : ''")
</template>
