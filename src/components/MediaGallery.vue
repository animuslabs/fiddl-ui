<script lang="ts" setup>
import { ref, computed, watch } from "vue"
import { useQuasar } from "quasar"
import { img, s3Video } from "lib/netlifyImg"

export interface MediaGalleryMeta {
  id: string
  url?: string
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
    showLoading?: boolean
    centerAlign?: boolean
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
  if ($q.screen.lt.md) return props.colsMobile
  return props.colsDesktop
})
const thumbSize = computed(() => (isMobile.value ? props.thumbSizeMobile : props.thumbSizeDesktop))
const gapValue = computed(() => (typeof props.gap === "number" ? `${props.gap}px` : props.gap))

const wrapperStyles = computed(() => {
  const isMosaic = props.layout === "mosaic"
  const base: Record<string, string> = {
    display: "grid",
    gap: gapValue.value,
  }

  if (isMosaic && props.centerAlign) {
    base.gridTemplateColumns = `repeat(${cols.value}, ${thumbSize.value}px)`
    base.gridAutoRows = `${thumbSize.value * props.rowHeightRatio}px`
    base.gridAutoFlow = "dense"
    base.justifyContent = "center"
  } else {
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
          maxWidth: "400px",
          aspectRatio: "1 / 1",
          "object-fit": "cover",
          display: "block",
        }
      : {
          width: "100%",
          height: "100%",
          maxWidth: "400px",
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
  return {
    gridRowEnd: `span ${Math.ceil((1 / aspect) * props.rowHeightRatio)}`,
    gridColumnEnd: colSpan ? `span ${colSpan}` : undefined,
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
    "cursor-pointer": props.selectable && !videoLoading.value[media.id],
    display: videoLoading.value[media.id] ? "none" : "block",
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
    template(v-if="m.type === 'image'")
      .media-wrapper(:style="mediaStyles")
        q-img(
          :src="m.url"
          style="width:100%; height:100%; object-fit: cover; display:block"
          spinner-color="white"
          :class="props.selectable ? 'cursor-pointer' : ''"
          @click="emit('select', { id: m.id, type: 'image' }); emit('selectedIndex', index)"
        )
        // Per-item actions slot (optional)
        slot(name="actions" :media="m" :index="index")
          // default empty
    template(v-else)
      .media-wrapper(:style="mediaStyles")
        div(v-if="props.showLoading && videoLoading[m.id]" style="position: relative" )
          div
            .absolute-center.z-top
              h4 Loading
            q-spinner-gears.absolute-center(color="grey-10" size="150px")
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
            style="width: 100%; height: 100%; object-fit: cover; display: block"
            :class="videoClass(m)"
          )
        // Per-item actions slot (optional)
        slot(name="actions" :media="m" :index="index")
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
</style>
