<template lang="pug">
q-dialog(
  ref="dialog"
  @hide="onDialogHide"
  :maximized="$q.screen.lt.md"
  :persistent="mediaViewerStore.isPersistent"
  transition-show="none"
  transition-hide="none"
)
  q-card.bg-transparent(style="width:100vw; max-width:100vw;" @click.self="hide()")
    .centered.full-width(@click="hide")
      MediaViewerMedia.full-width(
        :allowDelete="allowDelete"
        :initialCommentId="initialCommentId"
        @close="hide"
      )
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue"
import { QDialog } from "quasar"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { useUserAuth } from "src/stores/userAuth"
import { useMediaNavigation } from "src/lib/composables/useMediaNavigation"
import type { MediaGalleryMeta } from "src/types/media-gallery"
import MediaViewerMedia from "./MediaViewerMedia.vue"

interface Props {
  mediaObjects: MediaGalleryMeta[]
  requestId?: string
  startIndex?: number
  allowDelete?: boolean
  initialCommentId?: string | null
  // Optional: focus by specific media id (more robust than index when list mutates)
  startId?: string
}

const props = withDefaults(defineProps<Props>(), {
  requestId: "",
  startIndex: 0,
  allowDelete: true,
  initialCommentId: null,
})

const emit = defineEmits<{
  ok: []
  hide: []
}>()

const dialog = ref<QDialog | null>(null)
const mediaViewerStore = useMediaViewerStore()
const userAuth = useUserAuth()
const { updateRouteIndex } = useMediaNavigation()

onMounted(async () => {
  // Pass startId when provided to ensure the correct media opens
  // even if placeholder tiles are present or lists have shifted.
  await mediaViewerStore.initializeMediaViewer(props.mediaObjects, props.startIndex, props.startId)
  // Kick off progressive loads: LG first (fast CDN), then HD if available/allowed
  const tasks: Promise<any>[] = [mediaViewerStore.loadLgImage(), mediaViewerStore.loadHdMedia()]
  if (userAuth.loggedIn) tasks.unshift(mediaViewerStore.checkUserLikedMedia())
  await Promise.allSettled(tasks)
})

// Watch for current index changes to update route
watch(
  () => mediaViewerStore.currentIndex,
  () => {
    updateRouteIndex()
  },
  { immediate: false },
)

function show() {
  dialog.value?.show()
}

function hide() {
  dialog.value?.hide()
}

function onDialogHide() {
  // Always re-check for HD media after any dialog closes
  mediaViewerStore.triedHdLoad = false
  mediaViewerStore.hdMediaLoaded = false
  void mediaViewerStore.loadHdMedia()
  emit("hide")
}

function onOKClick() {
  emit("ok")
  hide()
}

// Expose methods for external usage
defineExpose({
  show,
  hide,
})
</script>
