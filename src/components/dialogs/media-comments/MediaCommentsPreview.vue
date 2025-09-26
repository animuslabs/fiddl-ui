<template lang="pug">
div.media-comments-preview.bg-black(:class="{ 'media-comments-preview--mobile': isMobile }")
  img.media-comments-preview-img(v-if="isImage" :src="previewUrl" alt="Selected media preview")
  video.media-comments-preview-video(
    v-else-if="isVideo"
    :src="previewUrl"
    ref="videoRef"
    controls
    playsinline
    autoplay
    :muted="isMuted"
  )
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, withDefaults } from "vue"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"

type MediaType = "image" | "video"

interface Props {
  mediaType: MediaType
  previewUrl: string
  isMobile?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isMobile: false,
})
const mediaViewerStore = useMediaViewerStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const isMuted = computed(() => mediaViewerStore.muted)

const isImage = computed(() => props.mediaType === "image")
const isVideo = computed(() => props.mediaType === "video")
const previewUrl = computed(() => props.previewUrl ?? "")
const isMobile = computed(() => props.isMobile)

function tryPlayPreview(resetTime = false) {
  const video = videoRef.value
  if (!video) return
  if (resetTime) {
    try {
      video.currentTime = 0
    } catch (err) {
      // Ignore seeking errors on unloaded videos
    }
  }
  const playPromise = video.play()
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {})
  }
}

onMounted(() => {
  if (!isVideo.value) return
  void nextTick(() => {
    tryPlayPreview(true)
  })
})

watch(
  () => props.mediaType,
  (type) => {
    if (type === "video") {
      void nextTick(() => {
        tryPlayPreview(true)
      })
    } else {
      const video = videoRef.value
      if (video) {
        video.pause()
      }
    }
  },
)

watch(
  () => previewUrl.value,
  () => {
    if (!isVideo.value) return
    void nextTick(() => {
      tryPlayPreview(true)
    })
  },
)
</script>

<style scoped>
.media-comments-preview {
  flex: 0 0 clamp(280px, 32%, 480px);
  max-width: 520px;
  max-height: 55vh;
  max-height: 55dvh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
}

.media-comments-preview--mobile {
  width: 100%;
  max-width: 100%;
  flex: 0 0 24vh;
  flex: 0 0 24dvh;
  max-height: 28vh;
  max-height: 28dvh;
  min-height: 160px;
  align-self: auto;
}

.media-comments-preview-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
}

.media-comments-preview-video {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
}
</style>
