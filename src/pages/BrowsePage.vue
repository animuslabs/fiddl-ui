<template lang="pug">
q-page.full-height.full-width.realtive-position.bg-black
  .centered.relative-position
    SearchBar(@setImageSize="imageSize = $event" fixed )
  .q-ma-md
    .full-width(style="height:40px;")
      .centered
        q-linear-progress(indeterminate :style="{visibility: browserStore.loading ? 'visible' : 'hidden'}").q-mr-md.q-ml-md
    ImageMosaic(:items="browserStore.items"  :imageSize="imageSize" )
  q-scroll-observer(@scroll="handleScroll")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useBrowserStore } from "stores/browserStore"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { AspectRatioGrade, aspectRatios, imageModels, ratioRatings } from "lib/imageModels"
import ImageMosaic from "components/ImageMosaic.vue"
import Quasar, { LocalStorage, throttle, useQuasar } from "quasar"
import { CreateImageRequestData } from "../../../fiddl-server/dist/lib/types/serverTypes"
import SearchBar from "src/components/BrowserSearchBar.vue"
let interval: any = null
// const gridModeOptions =
export default defineComponent({
  components: {
    CreatedImageCard,
    ImageMosaic,
    SearchBar,
  },
  data() {
    return {
      browserStore: useBrowserStore(),
      onScroll: null as any,
      onScrollUp: null as any,
      aspectRatios,
      imageModels,
      imageSize: null as "small" | "medium" | "large" | null,
    }
  },

  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      },
    },
  },
  unmounted() {
    if (interval) clearInterval(interval)
  },
  async mounted() {
    // Create a throttled scroll handler
    this.onScroll = throttle(() => {
      void this.browserStore.loadCreations()
    }, 1000)
    this.onScrollUp = throttle(() => {
      void this.browserStore.loadRecentCreations()
    }, 1000)

    await this.browserStore.loadCreations()
    await this.browserStore.loadRecentCreations()
    interval = setInterval(
      () => {
        void this.browserStore.loadRecentCreations()
      },
      5 * 60 * 1000,
    )
  },
  methods: {
    handleScroll(data: any) {
      const windowHeight = window.innerHeight
      const scrollPosition = data.position
      const pageHeight = document.body.scrollHeight
      // console.log("scroll")
      if (scrollPosition.top + windowHeight >= pageHeight / 1.5) {
        // console.log("Scrolled past the bottom!")
        this.onScroll()
      } else if (scrollPosition.top <= 0) {
        console.log("Scrolled to the top!")
        this.onScrollUp()
      }
    },
    imgClass(index: number, ratio: AspectRatioGrade) {
      let classes: string[] = []
      if (index === 0) classes.push("lg")
      else classes.push("sm")
      classes.push(ratio)
      return classes
    },
    reqFirstImg(req: CreateImageRequestData) {
      return req.imageIds[0] || false
    },
  },
})
</script>
