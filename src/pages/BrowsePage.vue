<template lang="pug">
q-page.full-height.full-width.realtive-position
  .centered.q-mt-sm
    .search-bar
      .centered
        q-form(@submit="browserStore.searchCreations()" inline style="width:500px; max-width:95vw;")
          .row
            q-btn-dropdown(:label="browserStore.filter.aspectRatio ||'Aspect Ratio'" flat)
              q-list
                q-item(clickable @click="browserStore.filter.aspectRatio = undefined" v-close-popup) Any
                q-item(clickable @click="browserStore.filter.aspectRatio = ratio" v-for="ratio of aspectRatios" v-close-popup) {{ ratio }}
            q-btn-dropdown(:label="browserStore.filter.model || 'Model'"  flat)
              q-list
                q-item(clickable @click="browserStore.filter.model = undefined" v-close-popup) Any
                q-item(clickable @click="browserStore.filter.model = model" v-for="model of imageModels" v-close-popup) {{ model }}
            q-btn(size="sm" icon="clear" flat @click="browserStore.resetFilters()" :disable="!browserStore.filterActive")
          .row.full-width.no-wrap
              q-input.full-width( @clear="browserStore.reset()" clearable v-model="browserStore.search" filled placeholder="search" square)
              q-btn(icon="search" type="submit" flat square )
        //- q-input(v-model="browserStore.search" filled placeholder="search" style="width:50%;")
  .centered
    //- q-spinner(size="10px" :style="{visibility: browserStore.loading ? 'visible' : 'hidden'}")
    q-linear-progress(indeterminate :style="{visibility: browserStore.loading ? 'visible' : 'hidden'}").q-mr-md.q-ml-md
  .q-ma-md
    ImageMosaic(:items="browserStore.items")
  //- .centered.q-ma-md
    q-btn(label="Load More" @click="browserStore.loadCreations()" :disable="browserStore.items.length < 1" :loading="browserStore.loading")
  q-scroll-observer(@scroll="handleScroll")

</template>
<style>
.search-bar {
  position: relative;
  width: 95vw;
  /* height: 95px; */
  /* background: rgba(1, 1, 1, 0.1);
  backdrop-filter: blur(50px);
  border-radius: 10px; */
  /* padding: 20px; */
  /* box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); */
}
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { useBrowserStore } from "stores/browserStore"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { AspectRatioGrade, aspectRatios, imageModels, ratioRatings } from "lib/imageModels"
import ImageMosaic from "components/ImageMosaic.vue"
import { throttle } from "quasar"
import { CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
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
      aspectRatios,
      imageModels,
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
    "browserStore.filter": {
      deep: true,
      handler() {
        this.browserStore.reset()
        // void this.browserStore.loadCreations()
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
      let classes = []
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
