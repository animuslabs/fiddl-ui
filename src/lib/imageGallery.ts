import { Dialog } from "quasar"
import ImageGallery from "src/components/dialogs/ImageGallery.vue"

const imageGallery = {
  show(imageIds: string[], startIndex = 0) {
    Dialog.create({
      component: ImageGallery,
      // fullHeight: true,
      // fullWidth: true,
      maximized: true,
      componentProps: {
        imageIds,
        startIndex,
      },
    })
  },
}
export default imageGallery
