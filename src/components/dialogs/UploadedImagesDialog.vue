<template lang="pug">
q-dialog(v-model="innerOpen" :maximized="$q.screen.lt.md")
  q-card(:class="cardClass")
    // Hidden native file input for uploads
    input(type="file" :multiple="multiSelect" @change="handleFileUpload" style="display: none;" ref="fileInputRef" accept="image/*")

    // Selection / upload chooser
    .q-ma-md(v-if="!showUploads")
      .row.items-center.justify-between.q-gutter-sm.dialog-header
        h4.q-mb-none {{ headerTitle }}
        .text-subtitle2.text-grey-4 Select existing uploads or add new images
      q-separator(color="primary").q-mt-sm.q-mb-lg
      .row.items-center.justify-center
        h5.q-mb-md Upload your Images
      .q-mx-lg.q-mb-lg
        .row.chooser-actions.items-center.justify-center.q-gutter-xl
          q-btn(size="lg" icon="upload" :label="multiSelect ? 'Upload Images' : 'Upload Image'" flat color="primary" @click="triggerFileInput")
            .badge
              p {{ prices.image.uploadSoloImage }}
          q-btn(size="lg" icon="list" label="Select from Uploads" flat color="primary" @click="showUploads = true")
        // Drag-drop area (desktop)
        div.drag-drop-area.gt-sm(@drop.prevent="handleDrop" @dragover.prevent @dragleave.prevent)
          .centered.bg-grey-9.q-pa-xl.q-mt-md
            p Drag and drop {{ multiSelect ? 'images' : 'an image' }} here

    // Uploads picker
    .q-ma-md(v-else).relative-position
      .row.items-center.justify-between.q-pa-sm.z-top.bg-blur(style="position:sticky; top:0; backdrop-filter: blur(8px);")
        h5.q-mb-none Select {{ multiSelect ? 'Images' : 'Image' }}
        .row.items-center.q-gutter-sm
          q-btn(flat dense icon="upload" :label="multiSelect ? 'Upload Images' : 'Upload Image'" color="primary" @click="triggerFileInput")
          q-btn(v-if="multiSelect" flat dense icon="done" label="Done" color="positive" @click="acceptSelection" :disable="!selectedIds.length")
          q-btn(flat dense icon="close" label="Cancel" color="secondary" @click="close")

      // Top pagination
      .row.justify-center.q-mt-sm
        q-pagination(
          v-if="rowsPerPage !== 0 && total > 0"
          v-model="page"
          :max="maxPages"
          max-pages="8"
          boundary-links
          direction-links
          color="primary"
          size="lg"
        )

      .q-ma-md
        UploadedImageViewer.full-width(
          @select="onUploadedSelected"
          @deleted="onUploadedDeleted"
          @loaded="onLoaded"
          :thumbSizeMobile="thumbSizeMobileProp"
          :selectedIds="multiSelect ? selectedIds : []"
          :limit="rowsPerPage || undefined"
          :offset="offset || undefined"
        )

      // Sticky footer on mobile showing selection count (multi only)
      div(v-if="multiSelect" class="z-top bg-blur q-pa-sm" style="position:sticky; bottom:20px; backdrop-filter: blur(8px);")
        .row.items-center.justify-between
          .text-caption {{ selectedIds.length }} selected (max {{ max }})
          q-btn(unelevated size="lg" icon="done_all" label="Done" color="positive" @click="acceptSelection" :disable="!selectedIds.length")

      // Bottom pagination + rows
      .row.items-center.q-gutter-sm.q-mt-sm
        q-select(v-model="rowsPerPage" :options="rowsPerPageOptions" label="Rows" dense outlined style="width:100px")
        q-space
        .row.justify-center.full-width
          q-pagination(
            v-if="rowsPerPage !== 0 && total > 0"
            v-model="page"
            :max="maxPages"
            max-pages="8"
            boundary-links
            direction-links
            color="primary"
            size="lg"
          )

      //- // Floating desktop Done button
      //- div(v-if="multiSelect && $q.screen.gt.xs" class="done-fab")
        //- q-btn(unelevated size="lg" color="positive" icon="done_all" label="Done" @click="acceptSelection" :disable="!selectedIds.length")
</template>

<script lang="ts" setup>
import { ref, watch, computed } from "vue"
import { useQuasar, Loading } from "quasar"
import { prices } from "stores/pricesStore"
import UploadedImageViewer from "components/UploadedImageViewer.vue"
import { createUploadImage } from "lib/orval"
import { uploadToPresignedPost } from "lib/api"
import { catchErr, throwErr } from "lib/util"
import { generateWebpThumbnails } from "lib/imageUtils"

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    multiSelect?: boolean
    max?: number
    thumbSizeMobile?: number
    context?: "image" | "video"
    // Optional list of already-selected image IDs to preselect when opening
    preselectedIds?: string[]
  }>(),
  {
    multiSelect: false,
    max: 10,
    thumbSizeMobile: 100,
    context: "image",
  },
)
const emit = defineEmits<{ (e: "update:modelValue", val: boolean): void; (e: "accept", ids: string[]): void }>()

const $q = useQuasar()
const innerOpen = ref(props.modelValue)
const showUploads = ref(false)
const selectedIds = ref<string[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
// Pagination state for uploads picker
const page = ref(1)
const rowsPerPage = ref(24)
const rowsPerPageOptions = [12, 24, 48, 96]
const total = ref(0)
const offset = computed(() => (rowsPerPage.value === 0 ? 0 : (page.value - 1) * rowsPerPage.value))
const maxPages = computed(() => {
  const rpp = rowsPerPage.value || 1
  return Math.max(1, Math.ceil(total.value / rpp))
})
watch(
  () => rowsPerPage.value,
  () => {
    page.value = 1
  },
)

// Helper to sanitize preselected list: unique + max limit
function sanitizePreselected(list: string[] | undefined): string[] {
  if (!Array.isArray(list) || !list.length) return []
  const unique = Array.from(new Set(list))
  return unique.slice(0, props.max)
}

watch(
  () => props.modelValue,
  (val) => {
    innerOpen.value = val
    if (val) {
      // Initialize selection from provided preselected list when opening
      selectedIds.value = props.multiSelect ? sanitizePreselected(props.preselectedIds) : []
      // Reset pagination on open
      page.value = 1
    } else {
      // Reset on close
      showUploads.value = false
      selectedIds.value = []
    }
  },
  { immediate: true },
)
watch(
  () => innerOpen.value,
  (val) => emit("update:modelValue", val),
)

const thumbSizeMobileProp = computed(() => props.thumbSizeMobile)
const headerTitle = computed(() => (props.context === "video" ? "Choose a starting image for your video" : "Create from your uploaded images"))
const cardClass = computed(() => ["uploads-dialog-card", showUploads.value ? "uploads-dialog-card--wide" : "uploads-dialog-card--narrow"])

function close() {
  innerOpen.value = false
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileUpload(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  if (props.multiSelect) {
    const fileList: File[] = Array.from(files)
    await uploadImages(fileList)
  } else {
    const first = files.item(0)
    if (!first) return
    await uploadImages([first])
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  if (props.multiSelect) {
    const fileList: File[] = Array.from(files)
    void uploadImages(fileList)
  } else {
    const first = files.item(0)
    if (!first) return
    void uploadImages([first])
  }
}

async function uploadImages(files: File[]) {
  Loading.show({ message: files.length > 1 ? `Uploading ${files.length} images` : "Uploading image" })
  try {
    const addedIds: string[] = []
    for (const file of files) {
      const [compressed] = await generateWebpThumbnails([file], 1024, 0.95, { allowUpscale: false })
      if (!compressed) throwErr("error compressing image for upload")
      const { data } = await createUploadImage({ fileType: "image/webp" })
      await uploadToPresignedPost({ file: compressed, presignedPost: data.uploadUrl })
      addedIds.push(data.imageId)
    }

    if (props.multiSelect) {
      // Merge into selection with max enforced
      const merged = [...selectedIds.value]
      for (const id of addedIds) {
        if (merged.length >= props.max) break
        if (!merged.includes(id)) merged.push(id)
      }
      selectedIds.value = merged
      // Multi-select: auto-accept and close
      if (merged.length) {
        emit("accept", [...merged])
        close()
      }
    } else {
      // Single: accept immediately with the first uploaded id
      if (addedIds.length) {
        emit("accept", [addedIds[0] as string])
        close()
      }
    }
  } catch (err: any) {
    catchErr(err)
  } finally {
    Loading.hide()
    // reset input so same file can be picked again
    if (fileInputRef.value) fileInputRef.value.value = ""
  }
}

function onUploadedSelected(id: string) {
  if (!props.multiSelect) {
    emit("accept", [id])
    close()
    return
  }
  // toggle selection in multi
  const exists = selectedIds.value.includes(id)
  if (exists) selectedIds.value = selectedIds.value.filter((x) => x !== id)
  else if (selectedIds.value.length < props.max) selectedIds.value.push(id)
  else if ($q.screen.gt.xs) {
    void $q.dialog({ title: "Limit reached", message: `Max ${props.max} images.`, ok: true })
  }
}

function onUploadedDeleted(id: string) {
  // Ensure any previously selected id is removed if the image was deleted
  if (!props.multiSelect) return
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  }
}

function onLoaded(t: number) {
  total.value = Number.isFinite(t as any) ? Number(t) : 0
  // Clamp current page if total shrank
  if (rowsPerPage.value > 0) {
    const max = Math.max(1, Math.ceil(total.value / rowsPerPage.value))
    if (page.value > max) page.value = max
  }
}

function acceptSelection() {
  if (!selectedIds.value.length) return
  emit("accept", [...selectedIds.value])
  close()
}
</script>

<style scoped>
.uploads-dialog-card {
  width: 90vw;
  max-width: 1400px;
}
.uploads-dialog-card--narrow {
  max-width: 900px;
}
.uploads-dialog-card--wide {
  max-width: 1400px;
}
/* When dialog is maximized (mobile), make card fill the viewport */
.q-dialog__inner--maximized .uploads-dialog-card {
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  border-radius: 0;
}
@media (min-width: 1024px) {
  .chooser-actions .q-btn {
    min-width: 220px;
  }
}
.dialog-header {
  padding: 6px 8px;
}
.drag-drop-area {
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  min-height: 120px;
}

.bg-blur {
  background: rgba(0, 0, 0, 0.3);
}

.done-fab {
  position: sticky;
  bottom: 16px;
  display: flex;
  justify-content: flex-end;
  padding-right: 12px;
  z-index: 15;
}
.done-fab .q-btn {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
</style>
