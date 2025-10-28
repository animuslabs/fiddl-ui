<template lang="pug">
q-page.full-height.full-width.relative-position
  .centered.relative-position
    // The search bar is fixed; we add a spacer below based on its runtime height
    SearchBar(ref="searchBarRef" :viewMode="viewMode" @setViewMode="viewMode = $event" fixed)
  // Use full margin on desktop/tablet; remove top margin on small screens
  div(:class="isSmallScreen ? 'q-mx-md q-mb-md' : 'q-ma-md'")
    .full-width(:style="{ height: searchBarHeight + 'px' }")
      .centered
        q-linear-progress(
          indeterminate
          :style="{ visibility: browserStore.loading ? 'visible' : 'hidden' }"
        ).q-mr-md.q-ml-md
    .centered.full-width
      MediaGallery(
        show-popularity
        selectable
        :mediaObjects="browserStore.media"
        :layout="viewMode"
        :rowHeightRatio="1.2"
        :show-loading="false"
        :skeleton-loading="browserStore.loading"
        :top-bar-height="18"
        :bottom-bar-height="26"
        show-creator
        gap="8px"
        :show-use-as-input="true"
        @select="handleSelect"
        :cols-desktop="8"
        :thumb-size-desktop="90"
        :cols-mobile="5"
        :thumb-size-mobile="60"
      )
  q-scroll-observer(@scroll="handleScroll")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, nextTick, computed } from "vue"
import { useBrowserStore } from "stores/browserStore"
import { throttle, useQuasar } from "quasar"
import SearchBar from "src/components/BrowserSearchBar.vue"
import MediaGallery from "components/MediaGallery.vue"
import { img } from "lib/netlifyImg"
import { pickRand } from "lib/util"
import mediaViwer from "lib/mediaViewer"

type MediaGalleryMeta = {
  id: string
  url: string
  type: "image" | "video"
  aspectRatio?: number
  nsfw?: boolean
}

// interval handle scoped to component instance

export default defineComponent({
  components: { SearchBar, MediaGallery },
  setup() {
    const $q = useQuasar()
    const browserStore = useBrowserStore()
    // Use mosaic by default on all screens; user toggle or saved preference may override
    const viewMode = ref<"grid" | "mosaic">("mosaic")
    const searchBarRef = ref<any>(null)
    const searchBarHeight = ref(56)
    const isSmallScreen = computed(() => $q.screen.lt.md)

    const onScroll = throttle(() => void browserStore.loadCreations(), 1000)
    const onScrollUp = throttle(() => void browserStore.loadRecentCreations(), 1000)

    const handleSelect = (p: { id: string; type: "image" | "video" }) => {
      const objs = browserStore.media
      const index = objs.findIndex((el) => el.id == p.id)
      // void mediaViwer.show(ids, index, p.type, p.id, false)
      void mediaViwer.show(objs, index)
    }

    const handleScroll = (data: any) => {
      const h = window.innerHeight
      const pos = data.position.top
      const pageH = document.body.scrollHeight
      if (pos + h >= pageH / 1.5) onScroll()
      else if (pos <= 0) onScrollUp()
    }

    let interval: ReturnType<typeof setInterval> | null = null

    function measureSearchBar() {
      try {
        const el = (searchBarRef.value && (searchBarRef.value.$el as HTMLElement)) || document.querySelector('.search-bar') as HTMLElement | null
        const h = el?.getBoundingClientRect().height || 56
        // Cap to a sensible range
        searchBarHeight.value = Math.max(40, Math.min(120, Math.round(h)))
      } catch {
        searchBarHeight.value = 56
      }
    }

    onMounted(() => {
      nextTick(() => measureSearchBar())
      window.addEventListener('resize', measureSearchBar)
    })
    void (async () => {
      await browserStore.loadCreations()
      await browserStore.loadRecentCreations()
      interval = setInterval(() => void browserStore.loadRecentCreations(), 300_000)
    })()

    onUnmounted(() => {
      if (interval) clearInterval(interval)
      window.removeEventListener('resize', measureSearchBar)
    })

    return {
      browserStore,
      imageSize: null as "small" | "medium" | "large" | null,
      handleScroll,
      handleSelect,
      viewMode,
      searchBarRef,
      searchBarHeight,
      isSmallScreen,
    }
  },
})
</script>
