<template lang="pug">
div
  .centered.q-pa-md(v-if="loading")
    q-spinner(size="40px" color="primary")
  template(v-else)
    template(v-if="mediaObjects.length")
      MediaGallery.q-pa-md(
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
        template(#actions="{ media }")
          q-btn(
            flat round size="sm" icon="delete" color="grey" no-caps
            :disable="deletingId === media.id"
            @click.stop="requestDelete(media.id, media.url)"
            style="posiiton:absolute; bottom:30px; right:4px;"
          )
    .centered.q-pa-lg(v-else)
      h6.text-grey-6 No uploaded images yet

  // Confirm deletion dialog
  q-dialog(v-model="confirmOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Delete Image?
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .centered
          q-img(v-if="confirmImageUrl" :src="confirmImageUrl" style="max-height:260px; max-width:100%; border-radius:8px;")
        p.q-mt-md This image will be permanently deleted from your uploads.
        p.text-negative.q-mt-xs This action cannot be undone.
      q-separator
      q-card-actions(align="right")
        q-btn(flat color="secondary" label="Cancel" no-caps v-close-popup)
        q-btn(color="negative" :loading="deleting" label="Delete" no-caps @click="confirmDelete")
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from "vue"
import { useQuasar } from "quasar"
import MediaGallery from "components/MediaGallery.vue"
import { s3Img } from "lib/netlifyImg"
import { creationsGetUserUploadedImages, creationsDeleteUploadedImage } from "lib/orval"

const emit = defineEmits<{ (e: "select", id: string): void; (e: "deleted", id: string): void }>()
const props = withDefaults(defineProps<{ thumbSizeMobile?: number; selectedIds?: string[] }>(), { thumbSizeMobile: 110, selectedIds: undefined })

const loading = ref(true)
const imageUploadIds = ref<string[]>([])
const $q = useQuasar()

// Delete confirmation state
const confirmOpen = ref(false)
const confirmImageId = ref<string | null>(null)
const confirmImageUrl = ref<string | null>(null)
const deleting = ref(false)
const deletingId = ref<string | null>(null)
let pendingRemoveIndex: number | null = null

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

function requestDelete(id: string, url?: string) {
  confirmImageId.value = id
  confirmImageUrl.value = url || s3Img("uploads/" + id)
  pendingRemoveIndex = imageUploadIds.value.findIndex((x) => x === id)
  confirmOpen.value = true
}

async function confirmDelete() {
  const id = confirmImageId.value
  if (!id) return
  confirmOpen.value = false
  deleting.value = true
  deletingId.value = id
  // Optimistic removal
  const idx = pendingRemoveIndex ?? imageUploadIds.value.findIndex((x) => x === id)
  let restored = false
  let removedItem: string | null = null
  if (idx >= 0) {
    removedItem = imageUploadIds.value.splice(idx, 1)[0] || null
  }
  try {
    await creationsDeleteUploadedImage({ imageId: id })
    emit("deleted", id)
    $q.notify({ color: "positive", message: "Image deleted" })
  } catch (e) {
    // Revert on error
    if (removedItem && idx >= 0) {
      imageUploadIds.value.splice(idx, 0, removedItem)
      restored = true
    }
    $q.notify({ color: "negative", message: "Failed to delete image" })
  } finally {
    deleting.value = false
    deletingId.value = null
    confirmImageId.value = null
    confirmImageUrl.value = null
    pendingRemoveIndex = null
  }
}
</script>

<style scoped></style>
