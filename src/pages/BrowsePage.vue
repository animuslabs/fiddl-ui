<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Browse
  .q-ma-md
    ImageMosaic(:items="browserStore.items")
  .centered.q-ma-md
    q-btn(label="Load More" @click="browserStore.loadCreations()" :disable="browserStore.items.length < 1")
  q-scroll-observer(@scroll="handleScroll")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useBrowserStore } from "src/stores/browserStore"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import { type CreatedItem } from "src/stores/createSessionStore"
import { AspectRatioGrade, ratioRatings } from "lib/imageModels"
import ImageMosaic from "components/ImageMosaic.vue"
import { debounce, Scroll, throttle } from "quasar"
let interval: any = null

export default defineComponent({
  components: {
    CreatedImageCard,
    ImageMosaic,
  },
  data() {
    return {
      browserStore: useBrowserStore(),
      onScroll: null as any,
      onScrollUp: null as any,
    }
  },
  computed: {
    // images(): string[] {},
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

    // await this.browserStore.loadCreations()
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
      let classes = []
      if (index === 0) classes.push("lg")
      else classes.push("sm")
      classes.push(ratio)
      return classes
    },
    reqFirstImg(req: CreatedItem) {
      return req.imageIds[0] || false
    },
  },
})
</script>
