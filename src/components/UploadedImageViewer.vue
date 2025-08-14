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
        :colsDesktop="10"
        :colsMobile="2"
        :thumbSizeDesktop="165"
        :thumbSizeMobile="140"
        :gap="8"
        :centerAlign="true"
        selectable
        @select="onSelect"
      )
    .centered.q-pa-lg(v-else)
      h6.text-grey-6 No uploaded images yet
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from "vue"
import MediaGallery from "components/MediaGallery.vue"
import { s3Img } from "lib/netlifyImg"
import { creationsGetUserUploadedImages } from "lib/orval"

const emit = defineEmits<{ (e: "select", id: string): void }>()

const loading = ref(true)
const imageUploadIds = ref<string[]>([])

onMounted(async () => {
  try {
    const { data } = await creationsGetUserUploadedImages()
    imageUploadIds.value = data
  } finally {
    loading.value = false
  }
})

const mediaObjects = computed(() => imageUploadIds.value.map((id) => ({ id, url: s3Img("uploads/" + id), type: "image" as const })))

function onSelect(payload: { id: string; type: "image" | "video" }) {
  emit("select", payload.id)
}
</script>

<style scoped>
</style>