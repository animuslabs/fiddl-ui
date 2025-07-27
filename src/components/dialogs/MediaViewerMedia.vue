<template lang="pug">
div
  //- Main media display area
  div.relative-position(
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  )
    transition(name="fade")
      q-linear-progress.absolute-top.full-width.image-darken(
        style="top:-2px;"
        indeterminate
        v-if="mediaViewerStore.imgLoading || mediaViewerStore.loading || mediaViewerStore.hdVideoLoading"
        color="primary"
        track-color="transparent"
      )

    div(v-if="mediaViewerStore.currentMediaType === 'video'" class="video-wrapper")
      video(
        ref="mediaElement"
        :src="mediaViewerStore.getCurrentMediaUrl()"
        class="image-darken"
        style="width:100%; max-height:75vh; object-fit:contain; transform:`translateX(${mediaViewerStore.touchState.moveX}px)`"
        playsinline
        autoplay
        loop
        @canplay="onMediaLoaded"
        @click.stop="onMediaClick"
        controls
      )

    img(
      v-else
      v-bind="imageAttrs"
      ref="mediaElement"
    )

    .absolute-top.full-width(style="width:100vw")
      .centered(v-if="mediaViewerStore.hdVideoLoading")
        h6.text-white HD Loading
  .centered.q-mt-md(v-if="showCreatorInfo")
    .q-pa-sm.r-xl.bg-blur
      CreatorInfo(
        :creatorMeta="mediaViewerStore.creatorMeta"
        usernameClass="text-white q-mr-sm"
        avatarSize="30px"
        wrapperClass=""
      )
  .centered.q-mt-md(v-if="showIndicators")
    span.indicator(
      v-for="(media, index) in mediaViewerStore.mediaObjects"
      :key="index"
      :class="{ active: index === mediaViewerStore.currentIndex }"
      @click.stop="mediaViewerStore.goToIndex(index)"
    )
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import CreatorInfo from "src/components/CreatorInfo.vue"

interface Props {
  downloadMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  downloadMode: false,
})

const mediaElement = ref<HTMLImageElement | HTMLVideoElement | null>(null)
const mediaViewerStore = useMediaViewerStore()

const showCreatorInfo = computed(() => mediaViewerStore.creatorMeta.userName.length > 0)

const showIndicators = computed(() => mediaViewerStore.mediaObjects.length > 1 && !props.downloadMode && mediaViewerStore.mediaObjects.length < 11)

const imageAttrs = computed(() => {
  const base = {
    class: mediaClass.value,
    style: {
      width: "100%",
      "max-height": "75vh",
      "object-fit": "contain",
      transform: `translateX(${mediaViewerStore.touchState.moveX}px)`,
    } as Record<string, string>,
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      onMediaClick(e)
    },
  }

  return {
    ...base,
    src: mediaViewerStore.getCurrentMediaUrl(),
    onLoad: (e: Event) => onMediaLoaded(e),
    alt: "user created image",
  }
})

const mediaClass = computed(() => {
  if (!mediaViewerStore.firstImageLoaded) return "image-darken"
  return mediaViewerStore.loading || mediaViewerStore.imgLoading ? "image-darken active" : "image-darken"
})

async function onMediaLoaded(event?: Event) {
  const isImage = mediaViewerStore.currentMediaType === "image"

  if (isImage && event) {
    const imgEl = event.target as HTMLImageElement
    if (imgEl.src.startsWith("data:image/")) {
      mediaViewerStore.hdMediaLoaded = true
    } else if (!mediaViewerStore.triedHdLoad) {
      // Only load HD if not already tried (prevents duplicate calls)
      await mediaViewerStore.loadHdMedia()
    }
  } else if (!isImage && !mediaViewerStore.hdMediaLoaded && !mediaViewerStore.triedHdLoad) {
    // Only load HD if not already tried (prevents duplicate calls)
    await mediaViewerStore.loadHdMedia()
  }

  mediaViewerStore.onMediaLoaded()

  // Preload and load metadata on first load only
  if (!mediaViewerStore.firstImageLoaded) {
    preloadMedia()
    // Only load request ID if not already loaded
    if (!mediaViewerStore.loadedRequestId) {
      await mediaViewerStore.loadRequestId()
    }
  }
}

function preloadMedia() {
  const preloadIndices = [mediaViewerStore.currentIndex - 1, mediaViewerStore.currentIndex + 1]
  preloadIndices.forEach((index) => {
    if (index >= 0 && index < mediaViewerStore.mediaObjects.length) {
      const mediaObj = mediaViewerStore.mediaObjects[index]
      if (!mediaObj) return
      const isVideo = mediaObj.type === "video"
      const url = isVideo
        ? mediaViewerStore.getCurrentMediaUrl() // Use store method for consistency
        : mediaViewerStore.getCurrentMediaUrl()
      if (isVideo) {
        const video = document.createElement("video")
        video.preload = "auto"
        video.src = url
        video.load()
      } else {
        const imgElement = new Image()
        imgElement.src = url
      }
    }
  })
}

function onMediaClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const width = rect.width

  if (clickX < width / 2) {
    mediaViewerStore.prevMedia()
  } else {
    mediaViewerStore.nextMedia()
  }
}

function handleTouchStart(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  mediaViewerStore.handleTouchStart(e.changedTouches[0].clientX)
}

function handleTouchMove(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  mediaViewerStore.handleTouchMove(e.changedTouches[0].clientX)
}

function handleTouchEnd(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  mediaViewerStore.handleTouchEnd()
}

// Watch for current media changes to update HD loading and creator info
watch(
  () => mediaViewerStore.currentMediaId,
  async (newId, oldId) => {
    if (!newId || !oldId) return // Skip initial load (handled by parent)

    // Reset states for new media
    mediaViewerStore.hdVideoLoading = false
    mediaViewerStore.hdMediaLoaded = false
    mediaViewerStore.triedHdLoad = false
    mediaViewerStore.userLikedMedia = false
    mediaViewerStore.userOwnsMedia = false

    // Reset creator info for new media
    mediaViewerStore.creatorMeta = { userName: "", id: "" }
    mediaViewerStore.loadedRequestId = null

    // Check like status and load HD media only for navigation between media
    await Promise.allSettled([mediaViewerStore.checkUserLikedMedia(), mediaViewerStore.loadHdMedia(), mediaViewerStore.loadRequestId()])
  },
  { immediate: false },
)
</script>

<style scoped>
.fade-enter-active {
  transition: opacity 0.5s ease 0.5s;
}
.fade-enter {
  opacity: 0;
}
.fade-enter-to {
  opacity: 1;
}
.image-darken {
  background-color: transparent;
  color: transparent;
  transition:
    filter 0.3s ease,
    transform 0.3s ease;
  will-change: transform;
}
.image-darken.hd-loaded {
  transform: scale(1.01);
}
.image-darken.active {
  filter: blur(3px) brightness(50%) saturate(50%);
}

.indicator {
  display: inline-block;
  height: 10px;
  width: 10px;
  margin: 0 5px 0px;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  cursor: pointer;
}
.active {
  background-color: rgba(255, 255, 255, 1);
}

.video-wrapper {
  max-height: 75vh;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.video-wrapper video {
  height: 100%;
  width: auto;
  object-fit: contain;
  max-height: 75vh;
  max-width: 100vw;
  margin: auto;
  display: block;
}
</style>
