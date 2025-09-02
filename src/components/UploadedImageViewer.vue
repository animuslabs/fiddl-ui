<template lang="pug">
div
  .centered.q-pa-md(v-if="loading")
    q-spinner(size="40px" color="primary")
  template(v-else)
    template(v-if="mediaObjects.length")
      MediaGallery.q-pl-md.q-pr-md(
        :mediaObjects="mediaObjects"
        layout="mosaic"
        :rowHeightRatio="1"
        :colsDesktop="desktopCols"
        :colsMobile="2"
        :thumbSizeDesktop="165"
        :thumbSizeMobile="thumbSizeMobile"
        :gap="8"
        :centerAlign="false"
        selectable
        :selectedIds="selectedIds"
        @select="onSelect"
      )
    .centered.q-pa-lg(v-else)
      h6.text-grey-6 No uploaded images yet
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from "vue"
import { useQuasar } from "quasar"
import MediaGallery from "components/MediaGallery.vue"
import { s3Img } from "lib/netlifyImg"
import { creationsGetUserUploadedImages } from "lib/orval"

const emit = defineEmits<{ (e: "select", id: string): void }>()
const props = withDefaults(defineProps<{ thumbSizeMobile?: number; selectedIds?: string[] }>(), { thumbSizeMobile: 110, selectedIds: undefined })

const loading = ref(true)
const imageUploadIds = ref<string[]>([])
const $q = useQuasar()

// Compute a responsive desktop column count so the gallery fills space without overflowing
const desktopCols = computed(() => {
  // approximate available width (dialog ~90vw with max 1400px)
  const containerWidth = Math.min($q.screen.width * 0.9, 1400)
  const thumb = 165
  const gap = 8
  const cols = Math.max(2, Math.floor(containerWidth / (thumb + gap)))
  return Math.min(12, cols)
})

onMounted(async () => {
  try {
    const { data } = await creationsGetUserUploadedImages()
    imageUploadIds.value = data
  } finally {
    loading.value = false
  }
})

const mediaObjects = computed(() => imageUploadIds.value.map((id) => ({ id, url: s3Img("uploads/" + id), type: "image" as const })))
const thumbSizeMobile = computed(() => props.thumbSizeMobile)
const selectedIds = computed(() => props.selectedIds || [])

function onSelect(payload: { id: string; type: "image" | "video" }) {
  emit("select", payload.id)
}
</script>

<style scoped></style>
