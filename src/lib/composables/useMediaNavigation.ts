import { onMounted, onUnmounted, nextTick } from "vue"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { updateQueryParams } from "src/lib/util"
import { useRoute } from "vue-router"

export function useMediaNavigation() {
  const mediaViewerStore = useMediaViewerStore()
  const route = useRoute()

  function handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowLeft":
        mediaViewerStore.prevMedia()
        break
      case "ArrowRight":
        mediaViewerStore.nextMedia()
        break
      case "Escape":
        // This will be handled by parent component
        break
      default:
        break
    }
  }

  function updateRouteIndex() {
    if (route.name === "imageRequest") {
      const query = { index: mediaViewerStore.currentIndex }
      const newQuery = { ...route.query, ...query }
      void nextTick(() => {
        updateQueryParams(newQuery)
      })
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown)
  })

  return {
    handleKeyDown,
    updateRouteIndex,
  }
}
