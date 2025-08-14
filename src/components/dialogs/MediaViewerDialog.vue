<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" maximized :persistent="mediaViewerStore.isPersistent")
  q-card.bg-transparent(style="width:90vw;" @click.self="hide()")
    .centered
      .col-auto
        .full-width
          .relative-position
            MediaViewerControls(
              :allowDelete="allowDelete"
              @close="hide"
            )

    .centered
      MediaViewerMedia
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue"
import { QDialog } from "quasar"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { useUserAuth } from "src/stores/userAuth"
import { useMediaNavigation } from "src/lib/composables/useMediaNavigation"
import type { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import MediaViewerControls from "./MediaViewerControls.vue"
import MediaViewerMedia from "./MediaViewerMedia.vue"

interface Props {
  mediaObjects: MediaGalleryMeta[]
  requestId?: string
  startIndex?: number
  allowDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  requestId: "",
  startIndex: 0,
  allowDelete: true,
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
  mediaViewerStore.initializeMediaViewer(props.mediaObjects, props.startIndex)
  if (userAuth.loggedIn) await Promise.allSettled([mediaViewerStore.checkUserLikedMedia(), mediaViewerStore.loadHdMedia()])
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
