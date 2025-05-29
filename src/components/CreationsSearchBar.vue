<template lang="pug">
.search-bar
  .centered
    q-form(@submit="creationsStore.searchCreations()" inline style="width:500px; max-width:100vw;")
      .row.no-wrap.items-center
        div
          q-btn-toggle(v-model="creationsStore.gridMode" flat :options="gridModeOptions")
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
            q-input(  style="min-width:200px;" @clear="()=>{creationsStore.reset(); creationsStore.resetFilters()}" clearable v-model="creationsStore.search" filled placeholder="search" square dense)
          .col-auto
            q-btn(icon="search" type="submit" flat square )
      .row.full-width.q-mb-sm.q-mt-sm.search-bar2( v-if="$q.screen.width < 600 && expandSearch")
        .col-grow
          q-input( style="min-width:200px;" @clear="creationsStore.reset()" clearable v-model="creationsStore.search" filled placeholder="search" square dense)
        .col-auto
          q-btn(icon="search" type="submit" flat square )
          q-btn(icon="keyboard_arrow_up" @click="exitTextSearch()" flat square v-if="expandSearch" size="sm" round )
</template>

<script lang="ts">
import { aspectRatios, imageModels } from "lib/imageModels"
import { LocalStorage, useQuasar } from "quasar"
import { useCreations } from "src/stores/creationsStore"
import { defineComponent } from "vue"

export default defineComponent({
  data() {
    return {
      $q: useQuasar(),
      creationsStore: useCreations(),
      aspectRatios,
      imageModels,
      gridModeOptions: [
        { icon: "grid_view", value: true },
        { icon: "list", value: false },
      ],
    }
  },
  computed: {
    expandSearch: {
      get() {
        return !!this.creationsStore.search
      },
      set(value: boolean) {
        if (value) this.creationsStore.search = ""
        else this.exitTextSearch()
      },
    },
  },
  watch: {
    "creationsStore.filter": {
      deep: true,
      handler() {
        this.creationsStore.reset()
        void this.creationsStore.loadCreations()
      },
    },
    "creationsStore.gridMode": {
      immediate: false,
      handler() {
        LocalStorage.set("creationsGridMode", this.creationsStore.gridMode)
      },
    },
  },
  mounted() {
    const savedGridMode = LocalStorage.getItem<boolean>("creationsGridMode")
    if (savedGridMode !== null) {
      this.creationsStore.gridMode = savedGridMode
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
