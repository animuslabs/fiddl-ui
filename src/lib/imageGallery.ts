import { Dialog } from "quasar"
import ImageGallery from "src/components/dialogs/MediaViewer.vue"

const imageGallery = {
  show(mediaIds: string[], startIndex = 0, type = "image" as "image" | "video", mediaRequestId?: string, allowDelete = true) {
    return new Promise<void>((res) => {
      Dialog.create({
        component: ImageGallery,
        // fullHeight: true,
        // fullWidth: true,
        maximized: true,
        componentProps: {
          mediaIds,
          startIndex,
          type,
          mediaRequestId,
          allowDelete,
        },
      }).onDismiss(() => {
        // void router.replace({ query: {} })

        const { pathname } = window.location
        // // Update URL without changing the scroll position
        window.history.replaceState({}, "", pathname)
        res()
      })
    })
  },
}
export default imageGallery
