// stores/createContextStore.ts — central UI context for Create page
import { defineStore } from "pinia"
import { reactive } from "vue"
import type { MediaType } from "lib/types"
import { LocalStorage } from "quasar"

export const useCreateContextStore = defineStore("createContextStore", () => {
  const state = reactive({
    activeTab: "image" as MediaType,
    initialized: false,
    hasLoaded: {
      image: false,
      video: false,
    },
    lastInitKey: null as string | null,
    gridMode: (LocalStorage.getItem("createPageGridMode2") as "list" | "grid" | "mosaic") || "grid",
    createMode: false,
  })

  function setActiveTab(tab: MediaType) {
    state.activeTab = tab
  }

  function setInitialized(val: boolean) {
    state.initialized = val
  }

  function setHasLoaded(tab: MediaType, val: boolean) {
    state.hasLoaded[tab] = val as any
  }

  function setGridMode(mode: "list" | "grid" | "mosaic") {
    state.gridMode = mode
    LocalStorage.set("createPageGridMode2", mode)
  }

  function setLastInitKey(key: string) {
    state.lastInitKey = key
  }

  return { state, setActiveTab, setInitialized, setHasLoaded, setGridMode, setLastInitKey }
})
