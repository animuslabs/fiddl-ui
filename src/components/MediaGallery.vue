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

const emit = defineEmits<{
  (e: "select", id: string): void
}>()

const $q = useQuasar()
const isMobile = computed(() => $q.screen.lt.md)
// const cols = computed(() => (isMobile.value ? props.colsMobile : props.colsDesktop))
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

const imgStyles = computed(() => {
  const base = {
    width: "100%",
    objectFit: "cover" as const,
  }

  if (props.layout === "grid") {
    return {
      ...base,
      height: `${thumbSize.value}px`,
      width: `${thumbSize.value}px`,
    }
  }

  // Let mosaic layout expand based on grid row height
  return {
    ...base,
    height: "100%",
  }
})

const galleryItems = ref<MediaGalleryMeta[]>([])

onMounted(async () => {
  galleryItems.value = await Promise.all(
    props.mediaObjects.map(async (item) => {
      const ratio = await getImageAspectRatio(item.url)
      console.log(ratio)
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
function getItemStyle(m: MediaGalleryMeta): Record<string, string | number | undefined> {
  if (props.layout !== "mosaic") return {}
  const aspect = m.aspectRatio ?? 1
  return {
    gridRowEnd: `span ${Math.ceil((1 / aspect) * props.rowHeightRatio)}`,
    gridColumnEnd: aspect > 1.5 ? "span 2" : undefined,
  }
}
</script>

<template lang="pug">
.full-width(:style="wrapperStyles")
  div(
    v-for="m in galleryItems"
    :key="m.id"
    :style="getItemStyle(m)"
  )
    q-img(
      :src="m.url"
      :style="imgStyles"
      @click="emit('select', m.id)"
      spinner-color="white"
      :class="selectable ? 'cursor-pointer':''"
    )
</template>
