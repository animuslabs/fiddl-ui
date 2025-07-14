<template lang="pug">
  q-dialog(ref="dialog" @hide="onHide" maximized persistent)
    q-card.q-dialog-plugin.bg-transparent(style="width:90vw;" @click="hide")
      media-viewer-header(@close="hide")
      media-viewer-display
      media-viewer-footer
  </template>

<script lang="ts" setup>
import { onMounted, ref } from "vue"
import { QDialog } from "quasar"
import { useMediaViewerStore } from "stores/mediaViewerStore"
import MediaViewerHeader from "./MediaViewerHeader.vue"
import MediaViewerDisplay from "./MediaViewerDisplay.vue"
import MediaViewerFooter from "./MediaViewerFooter.vue"

interface Props {
  mediaIds: string[]
  startIndex?: number
}
const props = withDefaults(defineProps<Props>(), { startIndex: 0 })
const emit = defineEmits(["hide"])

const viewer = useMediaViewerStore()
const dialog = ref<QDialog>()

function show() {
  dialog.value?.show()
}
function hide() {
  dialog.value?.hide()
}
function onHide() {
  viewer.$reset()
  emit("hide")
}

function key(e: KeyboardEvent) {
  if (e.key === "ArrowLeft") viewer.prev()
  else if (e.key === "ArrowRight") viewer.next()
  else if (e.key === "Escape") hide()
}

onMounted(() => {
  viewer.init(props.mediaIds, props.startIndex)
  show()
  window.addEventListener("keydown", key)
})
</script>
