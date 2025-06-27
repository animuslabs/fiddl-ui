<template lang="pug">
  q-card.q-pa-md.cursor-pointer(@dragover.prevent @drop.prevent="handleDrop($event)" style="max-width:95vw;" )
    .centered.q-mb-md
      h5 {{ isMobile ? 'Tap to select images' : 'Drag and drop images here' }}
    input.hidden(ref="fileInput" type="file" accept="image/*" multiple @change="handleFiles")
    q-separator.q-mt-md(color="grey-8")
    .thumb-grid.q-pa-lg.relative-position
      .absolute-center.q-pa-xl(v-if="!forgeStore.state.files.length" style="border: 2px dashed grey; border-radius: 8px;")
        q-icon(name="add_photo_alternate" size="64px" color="grey" @click="fileInput?.click()")
      .thumb(v-for="(file, i) in forgeStore.state.files" :key="i")
        img(:src="URL.createObjectURL(file)")
        button.remove-btn(@click="remove(i)") ×
    q-separator(color="grey-8")
    .centered.q-ma-sm
      q-chip( text-color="white" icon="data_usage" )
        | {{ forgeStore.totalSizeMB.value.toFixed(1) }} / {{ props.maxTotalSizeMB }} MB
      q-chip( text-color="white" icon="photo_library" )
        | {{ forgeStore.state.files.length }} / {{ props.maxFiles }} images
    .centered.q-gutter-sm.items-center
      q-btn(label="Clear All" color="grey" icon="delete" @click="clearItems" :disable="!forgeStore.state.files.length" outline)
      q-btn(outline color="primary" label="Select Files" icon="add_photo_alternate" @click="fileInput?.click()" )
      q-btn(v-if="!hideUploadButton" color="primary" label="Upload All" icon="cloud_upload" @click="triggerFilesReady" :disable="!forgeStore.state.files.length")
  </template>

<script setup lang="ts">
import { computed, ref, defineEmits, onMounted } from "vue"
import { Dialog, Notify, useQuasar } from "quasar"
import { useForgeStore } from "stores/forgeStore"

const quasar = useQuasar()
const isMobile = computed(() => quasar.platform.is.mobile)

const forgeStore = useForgeStore()
const { state, totalSizeMB, addFiles, clearFiles } = forgeStore

const props = defineProps({
  maxTotalSizeMB: { type: Number, default: 100 },
  maxFileSizeMB: { type: Number, default: 10 },
  maxFiles: { type: Number, default: 50 },
  hideUploadButton: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: "filesReady", files: File[]): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const URL = window.URL

function triggerFilesReady() {
  emit("filesReady", [...state.files])
}

function clearItems() {
  Dialog.create({
    title: "Clear All Files",
    message: "Are you sure you want to clear all files?",
    cancel: true,
    persistent: true,
    ok: {
      label: "Clear",
      color: "negative",
    },
  }).onOk(() => {
    clearFiles()
    if (fileInput.value) {
      fileInput.value.value = ""
    }
  })
}
onMounted(() => {
  forgeStore.reset()
})

function validateFiles(newFiles: File[]) {
  const errors: string[] = []

  if (state.files.length + newFiles.length > props.maxFiles) {
    errors.push("Too many files.")
  }

  for (const file of newFiles) {
    if (!file.type.startsWith("image/")) {
      errors.push(`File ${file.name} is not an image.`)
    }
    if (file.size / (1024 * 1024) > props.maxFileSizeMB) {
      errors.push(`File ${file.name} exceeds the max file size.`)
    }
  }

  const newTotalSize = totalSizeMB.value * 1024 * 1024 + newFiles.reduce((acc, f) => acc + f.size, 0)
  if (newTotalSize / (1024 * 1024) > props.maxTotalSizeMB) {
    errors.push("Total size exceeds limit.")
  }

  const existingFiles = new Set(state.files.map((f) => f.name))
  for (const file of newFiles) {
    if (existingFiles.has(file.name)) {
      errors.push(`File ${file.name} is already included.`)
    }
  }

  return errors
}

function handleDrop(e: DragEvent) {
  const dropped = Array.from(e.dataTransfer?.files || [])
  const errors = validateFiles(dropped)
  if (errors.length) {
    Notify.create({
      type: "negative",
      message: errors.join("\n"),
      multiLine: true,
      position: "top",
    })
    return
  }
  addFiles(dropped.filter((f) => f.type.startsWith("image/")))
}

function handleFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = Array.from(input.files || [])
  const errors = validateFiles(selected)
  if (errors.length) {
    Notify.create({
      type: "negative",
      message: errors.join("\n"),
      multiLine: true,
      position: "top",
    })
    return
  }
  addFiles(selected.filter((f) => f.type.startsWith("image/")))
  input.value = ""
}

function remove(index: number) {
  state.files.splice(index, 1)
}
</script>

<style scoped>
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  max-width: 700px;
  min-height: 200px;
  /* width: 300px; */
}

.thumb {
  position: relative;
  aspect-ratio: 1/1;
  overflow: hidden;
  border-radius: 8px;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}
</style>
