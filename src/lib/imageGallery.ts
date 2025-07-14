import { Dialog } from "quasar"
import ImageGallery from "src/components/dialogs/ImageGallery.vue"
import MediaViewer from "src/components/MediaViewer/MediaViewer.vue"

const imageGallery = {
  show(mediaIds: string[], startIndex = 0, type = "image" as "image" | "video", imageRequestId?: string) {
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
          imageRequestId,
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
