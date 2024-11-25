<template lang="pug">
.search-bar
  .centered
    q-form(@submit="browserStore.searchCreations()" inline style="width:500px; max-width:100vw;")
      .row.no-wrap.items-center
        div
          q-btn-toggle(v-model="viewMode.imageSize" flat :options="gridModeOptions")
        q-btn-dropdown(:label="browserStore.filter.aspectRatio ||'Aspect'" flat :color="browserStore.filter.aspectRatio ? 'primary' : 'white'")
          q-list
            q-item(clickable @click="browserStore.filter.aspectRatio = undefined" v-close-popup) Any
            q-item(clickable @click="browserStore.filter.aspectRatio = ratio" v-for="ratio of aspectRatios" v-close-popup) {{ ratio }}
        q-btn-dropdown(:label="browserStore.filter.model || 'Model'" :color="browserStore.filter.model ? 'primary' : 'white'" flat)
          q-list
            q-item(clickable @click="browserStore.filter.model = undefined" v-close-popup) Any
            q-item(clickable @click="browserStore.filter.model = model" v-for="model of imageModels" v-close-popup) {{ model }}
        q-btn(size="sm" icon="clear" flat @click="browserStore.resetFilters()" v-if="browserStore.filterActive")
        q-btn(size="sm" icon="search" flat @click="expandSearch = true" v-if="!expandSearch && $q.screen.width < 600")
        .row(v-if="$q.screen.width >= 600").no-wrap.items-center
          .col-grow
            q-input(  style="min-width:200px;" @clear="browserStore.reset()" clearable v-model="browserStore.search" filled placeholder="search" square dense)
          .col-auto
            q-btn(icon="search" type="submit" flat square )
      .row.full-width.q-pb-sm.q-pt-sm.search-bar2.no-wrap( v-if="$q.screen.width < 600 && expandSearch" style="  backdrop-filter: blur(30px); background-color: rgba(0, 0, 0, 0.1);")
        .col-grow
          q-input(@clear="browserStore.reset()" clearable v-model="browserStore.search" filled placeholder="search" square dense)
        .col-auto
          q-btn(icon="search" type="submit" flat square )
          q-btn(icon="keyboard_arrow_up" @click="exitTextSearch()" flat square v-if="expandSearch" size="sm" round )
</template>
<style scoped>
.search-bar {
  position: relative;
  width: 100vw;
  backdrop-filter: blur(30px);
  background-color: rgba(0, 0, 0, 0.1);
  position: fixed;
  z-index: 100;
  height: auto;
}
.search-bar2 {
  backdrop-filter: blur(30px);
  background-color: rgba(0, 0, 0, 0.1);
}
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { useBrowserStore } from "stores/browserStore"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { AspectRatioGrade, aspectRatios, imageModels, ratioRatings } from "lib/imageModels"
import ImageMosaic from "components/ImageMosaic.vue"
import Quasar, { LocalStorage, throttle, useQuasar } from "quasar"
import { CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
let interval: any = null
// const gridModeOptions =
export default defineComponent({
  emits: {
    setImageSize: (size: "small" | "medium" | "large" | null) => true,
  },
  data() {
    return {
      browserStore: useBrowserStore(),
      aspectRatios,
      imageModels,
      expandSearch: false,
      viewMode: {
        gridMode: null,
        imageSize: null as "small" | "medium" | "large" | null,
      },
      gridModeOptions: [
        { icon: "grid_view", value: useQuasar().screen.lt.md ? "small" : "medium" },
        { icon: "dashboard", value: null },
      ],
    }
  },
  watch: {
    "browserStore.filter": {
      deep: true,
      handler() {
        this.browserStore.reset()
      },
    },
    "viewMode.imageSize": {
      handler(val) {
        console.log("emit imageSize event", val)
        LocalStorage.set("browserImageSize", val)
        this.$emit("setImageSize", val)
      },
      immediate: false,
    },
  },
  mounted() {
    const savedImageSize = LocalStorage.getItem("browserImageSize")
    console.log("savedSize", savedImageSize, typeof savedImageSize)
    if (savedImageSize == "null" || !savedImageSize) this.viewMode.imageSize = null
    else this.viewMode.imageSize = this.$q.screen.gt.sm ? "medium" : "small"
    console.log("viewMode", this.viewMode.imageSize)
  },
  methods: {
    exitTextSearch() {
      this.expandSearch = false
      this.browserStore.search = ""
      this.browserStore.searchCreations()
    },
  },
})
</script>
