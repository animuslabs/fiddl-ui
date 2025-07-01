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
        q-btn(size="sm" icon="search" flat @click="expandSearch = true" v-if="!expandSearch && quasar.screen.width < 600")
        .row(v-if="quasar.screen.width >= 600").no-wrap.items-center
          .col-grow
            q-input(  style="min-width:200px;" @clear="browserStore.reset()" clearable v-model="browserStore.search" filled placeholder="search" square dense)
          .col-auto
            q-btn(icon="search" type="submit" flat square )
      .row.full-width.q-pb-sm.q-pt-sm.no-wrap( v-if="quasar.screen.width < 600 && expandSearch")
        .col-grow
          q-input(@clear="browserStore.reset()" clearable v-model="browserStore.search" filled placeholder="search" square dense)
        .col-auto
          q-btn(icon="search" type="submit" flat square )
          q-btn(icon="keyboard_arrow_up" @click="exitTextSearch()" flat square v-if="expandSearch" size="sm" round )
</template>

<script lang="ts">
import { aspectRatios, imageModels } from "lib/imageModels"
import { LocalStorage, useQuasar } from "quasar"
import { useBrowserStore } from "stores/browserStore"
import { defineComponent } from "vue"
let interval: any = null
// const gridModeOptions =
export default defineComponent({
  emits: {
    setImageSize: (size: "small" | "medium" | "large" | null) => true,
  },
  data() {
    return {
      quasar: useQuasar(),
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
    else this.viewMode.imageSize = this.quasar.screen.gt.sm ? "medium" : "small"
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
