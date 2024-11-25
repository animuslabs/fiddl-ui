<template lang="pug">
.search-bar
  .centered
    q-form(@submit="creationsStore.searchCreations()" inline style="width:500px; max-width:95vw;")
      .row.no-wrap.items-center
        div
          q-btn-toggle(v-model="gridMode" flat :options="gridModeOptions")
        q-btn-dropdown(:label="creationsStore.filter.aspectRatio ||'Aspect'" flat :color="creationsStore.filter.aspectRatio ? 'primary' : 'white'")
          q-list
            q-item(clickable @click="creationsStore.filter.aspectRatio = undefined" v-close-popup) Any
            q-item(clickable @click="creationsStore.filter.aspectRatio = ratio" v-for="ratio of aspectRatios" v-close-popup) {{ ratio }}
        q-btn-dropdown(:label="creationsStore.filter.model || 'Model'" :color="creationsStore.filter.model ? 'primary' : 'white'" flat)
          q-list
            q-item(clickable @click="creationsStore.filter.model = undefined" v-close-popup) Any
            q-item(clickable @click="creationsStore.filter.model = model" v-for="model of imageModels" v-close-popup) {{ model }}
        q-btn(size="sm" icon="clear" flat @click="creationsStore.resetFilters()" v-if="creationsStore.filterActive")
        q-btn(size="sm" icon="search" flat @click="expandSearch = true" v-if="!expandSearch && $q.screen.width < 600")
        .row(v-if="$q.screen.width >= 600").no-wrap
          .col-grow
            q-input(  style="min-width:200px;" @clear="creationsStore.reset()" clearable v-model="creationsStore.search" filled placeholder="search" square dense)
          .col-auto
            q-btn(icon="search" type="submit" flat square )
      .row.full-width.q-mb-sm.q-mt-sm.search-bar2( v-if="$q.screen.width < 600 && expandSearch")
        .col-grow
          q-input( style="min-width:200px;" @clear="creationsStore.reset()" clearable v-model="creationsStore.search" filled placeholder="search" square dense)
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
import { useCreations } from "src/stores/creationsStore"
let interval: any = null

export default defineComponent({
  emits: {
    setGridMode: (va: boolean) => true,
  },
  data() {
    return {
      creationsStore: useCreations(),
      aspectRatios,
      imageModels,
      expandSearch: false,
      gridMode: false,
      gridModeOptions: [
        { icon: "grid_view", value: true },
        { icon: "list", value: false },
      ],
    }
  },
  watch: {
    "creationsStore.filter": {
      deep: true,
      handler() {
        this.creationsStore.reset()
      },
    },
    gridMode: {
      handler(val: boolean) {
        console.log("emit creations gridMode event", val)
        LocalStorage.set("creationsGridMode", val)
        this.$emit("setGridMode", val)
      },
      immediate: false,
    },
  },
  mounted() {
    const savedGridMode = LocalStorage.getItem<boolean>("creationsGridMode")
    if (savedGridMode !== null) {
      this.gridMode = savedGridMode
    }
  },
  methods: {
    exitTextSearch() {
      this.expandSearch = false
      this.creationsStore.search = ""
      this.creationsStore.searchCreations()
    },
  },
})
</script>
