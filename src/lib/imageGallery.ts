import { Dialog } from "quasar"
import ImageGallery from "src/components/dialogs/ImageGallery.vue"
import router from "src/router"
import globalRouter from "src/router/globalRouter"

const imageGallery = {
  show(imageIds: string[], startIndex = 0, imageRequestId?: string) {
    Dialog.create({
      component: ImageGallery,
      // fullHeight: true,
      // fullWidth: true,
      maximized: true,
      componentProps: {
        imageIds,
        startIndex,
        imageRequestId,
      },
    }).onDismiss(() => {
      // void router.replace({ query: {} })
      // const { pathname } = window.location
      // // Update URL without changing the scroll position
      // window.history.replaceState({}, "", pathname)
    })
  },
}
export default imageGallery