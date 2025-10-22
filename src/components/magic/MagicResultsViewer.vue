<template lang="pug">
h1 {{ isDesktop }}
//- div.fullscreen-wrapper
  MediaGallery.q-pa-md(
    v-if="isDesktop"
    :mediaObjects="mediaObjects"
  ).bg-red
  // Mobile: keep swipe-style viewer with actions
  template(v-else)
    //- Image area
    div.viewer-area
      q-img(
        v-if="currentImageUrl"
        :src="currentImageUrl"
        spinner-color="white"
        style="width:100%; height:100%; object-fit:contain; background:#000"
        :ratio="0"
      )
      //- Dots pagination
      div.dots
        span.dot(
          v-for="(id, idx) in imageIds"
          :key="id + '-' + idx"
          :class="{ active: idx === currentIndex }"
          @click="currentIndex = idx"
        )
    //- Bottom actions
    div.actions
      q-btn.action-btn( color="primary" icon="share" label="Share" size="lg" no-caps @click="share" )
      q-btn(
        outline
        color="primary"
        icon="download"
        label="Download"
        class="action-btn"
        size="lg"
        no-caps
        @click="download"
      )
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useQuasar } from "quasar"
import { img } from "lib/netlifyImg"
import { hdDownloadUrl, originalDownloadUrl } from "src/lib/imageCdn"
import MediaGallery from "src/components/MediaGallery.vue"
import type { MediaGalleryMeta } from "src/types/media-gallery"

const props = withDefaults(
  defineProps<{
    imageIds: string[]
    startIndex?: number
  }>(),
  { startIndex: 0 },
)

const $q = useQuasar()
const isDesktop = computed(() => $q.screen.gt.sm)
const currentIndex = ref<number>(props.startIndex || 0)

watch(
  () => props.startIndex,
  (val) => {
    if (typeof val === "number") currentIndex.value = Math.max(0, Math.min(val, (props.imageIds?.length || 1) - 1))
  },
)

const currentImageId = computed(() => props.imageIds?.[currentIndex.value] || null)
const currentImageUrl = computed(() => (currentImageId.value ? img(currentImageId.value, "lg") : ""))

const mediaObjects = computed<MediaGalleryMeta[]>(() => (props.imageIds || []).map((id) => ({ id, url: img(id, "lg"), type: "image" })))

async function share() {
  try {
    const url = currentImageUrl.value
    const tg: any = (window as any)?.Telegram?.WebApp
    const inTma = Boolean((window as any)?.__TMA__?.enabled && tg)
    // Prefer Telegram story share if available (uses image file, better UX)
    if (inTma) {
      try {
        const orig = await originalDownloadUrl(currentImageId.value || "").catch(() => url)
        const canStory = typeof tg?.shareToStory === "function" && /\.(png|jpe?g)$/i.test(orig)
        if (canStory) {
          tg.shareToStory(orig, {
            text: "Made with Fiddl.art",
            widget_link: { url: window.location.origin, text: "Open Fiddl.art" },
          })
          return
        }
      } catch {}
      if (typeof tg?.openTelegramLink === "function") {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Check out my Magic Mirror image")}`
        tg.openTelegramLink(shareUrl)
        return
      }
    }
    // Fallbacks: Web Share, then clipboard
    if ((navigator as any).share) {
      await (navigator as any).share({ title: "My Magic Mirror image", text: "Check out my Magic Mirror result", url })
      return
    }
    await navigator.clipboard.writeText(url)
    $q.notify({ message: "Link copied to clipboard", color: "primary" })
  } catch (e: any) {
    console.warn("share failed", e)
    $q.notify({ message: "Unable to share", color: "negative" })
  }
}

async function download() {
  try {
    const url = await hdDownloadUrl(currentImageId.value || "")
      .catch(async () => currentImageUrl.value)
    if (!url) throw new Error("No image")
    const filename = (currentImageId.value || "image") + ".webp"
    const tg: any = (window as any)?.Telegram?.WebApp
    const inTma = Boolean((window as any)?.__TMA__?.enabled && tg)
    if (inTma && typeof tg?.downloadFile === "function") {
      const params: any = { url, file_name: filename, filename }
      tg.downloadFile(params, () => {})
      return
    }
    // Fetch as blob for reliable downloading (mirrors MediaViewerControls approach)
    const resp = await fetch(url, { mode: "cors" })
    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  } catch (e: any) {
    console.warn("download failed", e)
    $q.notify({ message: "Download failed", color: "negative" })
  }
}
</script>

<style scoped>
.fullscreen-wrapper {
  position: relative;
  inset: 0;
  width: 100%;
  min-height: calc(100vh - 120px);
  min-height: calc(100dvh - 120px);
  background: #000;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.viewer-area {
  position: relative;
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.2), transparent);
  position: sticky;
  bottom: 0;
}
.action-btn {
  min-width: 160px;
}
.dots {
  position: absolute;
  bottom: 14px;
  left: 0;
  right: 0;
  display: flex;
  gap: 6px;
  justify-content: center;
}
.dot {
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dot.active {
  width: 18px;
  background: var(--q-primary);
}
</style>
