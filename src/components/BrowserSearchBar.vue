<template lang="pug">
.search-bar
  .centered
    q-form(@submit="onSubmit" inline style="max-width:100vw;")
      .row.no-wrap.items-center.hide-scrollbar(style="overflow: auto; width:fit-content; max-width:100vw;")
        //- q-btn(:label="browserStore.filter.sort" @click="browserStore.toggleSort")
        q-btn-dropdown(:label="browserStore.filter.mediaType || 'Media Type'" flat color="primary" :icon="mediaTypeIcon[browserStore.filter.mediaType]")
          q-list
            .q-ma-md.cursor-pointer.relative-position(v-for="(icon,method) in mediaTypeIcon" clickable @click="browserStore.setMediaType(method)" v-close-popup )
              .absolute.bg-primary(style="left:-5px; height:100%; width:5px;" v-if="browserStore.filter.mediaType == method")
              .row.items-center.no-wrap
                q-icon.q-mr-md.q-ml-sm(:name="icon" size="md" )
                p {{ method }}
        q-btn-dropdown(:label="browserStore.filter.sort || 'Sort'" flat color="primary" :icon="sortMethodIcon[browserStore.filter.sort]")
          q-list
            .q-ma-md.cursor-pointer.relative-position(v-for="(icon,method) in sortMethodIcon" clickable @click="browserStore.setSort(method)" v-close-popup )
              .absolute.bg-primary(style="left:-5px; height:100%; width:5px;" v-if="browserStore.filter.sort == method")
              .row.items-center.no-wrap
                q-icon.q-mr-md.q-ml-sm(:name="icon" size="md" )
                p {{ method }}

        q-separator(vertical)
        div
          q-btn-toggle(v-model="localViewMode" flat :options="gridModeOptions")
        q-separator(vertical)
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
import { useBrowserStore, sortMethodIcon, mediaTypeIcon } from "stores/browserStore"
import { defineComponent, PropType } from "vue"
import { events } from "lib/eventsManager"

let interval: any = null
// const gridModeOptions =
export default defineComponent({
  emits: {
    setViewMode: (size: "grid" | "mosaic") => true,
  },
  props: {
    // Parent-provided current view mode
    viewMode: {
      type: String as PropType<"grid" | "mosaic">,
      default: "mosaic",
    },
  },
  data() {
    return {
      mediaTypeIcon,
      sortMethodIcon,
      quasar: useQuasar(),
      browserStore: useBrowserStore(),
      aspectRatios,
      imageModels,
      expandSearch: false,
      // Internal local state for the toggle
      localViewMode: "mosaic" as "mosaic" | "grid",
      gridModeOptions: [
        { icon: "grid_view", value: "grid" },
        { icon: "dashboard", value: "mosaic" },
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
    // Emit when the internal toggle changes
    localViewMode: {
      handler(val) {
        console.log("emit imageSize event", val)
        LocalStorage.set("browserViewMode", val)
        this.$emit("setViewMode", val)
      },
      immediate: false,
    },
    // Keep internal in sync if parent prop changes
    viewMode(val: "grid" | "mosaic") {
      if (val && val !== this.localViewMode) this.localViewMode = val
    },
  },
  mounted() {
    const savedViewMode = LocalStorage.getItem("browserViewMode") as "grid" | "mosaic" | null
    // Prefer saved user choice; otherwise sync with parent-provided mode
    this.localViewMode = (savedViewMode || this.viewMode || "mosaic") as any
  },
  methods: {
    exitTextSearch() {
      this.expandSearch = false
      this.browserStore.search = ""
      this.browserStore.searchCreations()
    },
    onSubmit(e: Event) {
      try { e?.preventDefault?.() } catch {}
      const q = (this.browserStore.search || "").trim()
      if (q) {
        try { events.search(q) } catch {}
      }
      this.browserStore.searchCreations()
    },
  },
})
</script>

<style>
.hide-scrollbar {
  overflow: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}
</style>
