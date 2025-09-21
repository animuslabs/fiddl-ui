<template lang="pug">
div.media-comments-preview.bg-black
  img.media-comments-preview-img(v-if="isImage" :src="previewUrl" alt="Selected media preview")
  video.media-comments-preview-video(v-else-if="isVideo" :src="previewUrl" controls playsinline)
</template>

<script setup lang="ts">
import { computed } from "vue"

type MediaType = "image" | "video"

interface Props {
  mediaType: MediaType
  previewUrl: string
}

const props = defineProps<Props>()

const isImage = computed(() => props.mediaType === "image")
const isVideo = computed(() => props.mediaType === "video")
const previewUrl = computed(() => props.previewUrl ?? "")
</script>

<style scoped>
.media-comments-preview {
  flex: 0 0 clamp(280px, 32%, 480px);
  max-width: 520px;
  max-height: 55vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
}

:global(.media-comments-dialog--mobile) .media-comments-preview {
  flex: 0 0 20dvh;
  max-height: 20dvh;
  width: 100%;
  max-width: 100%;
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
