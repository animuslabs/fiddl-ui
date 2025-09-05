<template lang="pug">
q-page.full-height.full-width.relative-position
  .centered.relative-position
    SearchBar(@setViewMode="viewMode = $event" fixed)
  .q-ma-md
    .full-width(style="height:40px;")
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
        gap="8px"
        @select="handleSelect"
        :cols-desktop="8"
        :thumb-size-desktop="90"
        :cols-mobile="3"
        :thumb-size-mobile="60"
      )
  q-scroll-observer(@scroll="handleScroll")
</template>

<script lang="ts">
import { defineComponent, computed, ref, onUnmounted } from "vue"
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
}

// interval handle scoped to component instance

export default defineComponent({
  components: { SearchBar, MediaGallery },
  setup() {
    const $q = useQuasar()
    const browserStore = useBrowserStore()
    const viewMode = ref<"grid" | "mosaic">("mosaic")

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
    void (async () => {
      await browserStore.loadCreations()
      await browserStore.loadRecentCreations()
      interval = setInterval(() => void browserStore.loadRecentCreations(), 300_000)
    })()

    onUnmounted(() => {
      if (interval) clearInterval(interval)
    })

    return {
      browserStore,
      imageSize: null as "small" | "medium" | "large" | null,
      handleScroll,
      handleSelect,
      viewMode,
    }
  },
})
</script>
