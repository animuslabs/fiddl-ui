<script lang="ts" setup>
import { ref, computed, onMounted } from "vue"
import { useQuasar } from "quasar"

export interface MediaGalleryMeta {
  id: string
  url: string
  aspectRatio?: number // optional, used for mosaic layout
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
  }>(),
  {
    layout: "grid",
    colsDesktop: 4,
    colsMobile: 2,
    gap: "8px",
    thumbSizeDesktop: 200,
    thumbSizeMobile: 120,
    selectable: false,
  },
)

const emit = defineEmits<{
  (e: "select", id: string): void
}>()

const $q = useQuasar()
const isMobile = computed(() => $q.screen.lt.md)
const cols = computed(() => (isMobile.value ? props.colsMobile : props.colsDesktop))
const thumbSize = computed(() => (isMobile.value ? props.thumbSizeMobile : props.thumbSizeDesktop))
const gapValue = computed(() => (typeof props.gap === "number" ? `${props.gap}px` : props.gap))

const wrapperStyles = computed(() => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gap: gapValue.value,
  ...(props.layout === "mosaic"
    ? {
        gridAutoRows: `${thumbSize.value}px`,
        gridAutoFlow: "dense",
      }
    : {}),
}))

const imgStyles = computed(() => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "8px",
}))

const galleryItems = ref<MediaGalleryMeta[]>([])

onMounted(async () => {
  galleryItems.value = await Promise.all(
    props.mediaObjects.map(async (item) => {
      const ratio = await getImageAspectRatio(item.url)
      return { ...item, aspectRatio: ratio }
    }),
  )
})

async function getImageAspectRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1)
    img.onerror = () => resolve(1)
    img.src = url
  })
}
</script>

<template lang="pug">
.full-width(:style="wrapperStyles")
  div(
    v-for="m in galleryItems"
    :key="m.id"
    :style="props.layout === 'mosaic' ? { gridRowEnd: 'span ' + Math.ceil((m.aspectRatio ?? 1) * 1.2) } : {}"
  )
    q-img(
      :src="m.url"
      :style="imgStyles"
      @click="emit('select', m.id)"
      spinner-color="white"
      :class="selectable ? 'cursor-pointer':''"
    )
</template>
