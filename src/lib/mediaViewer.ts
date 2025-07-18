import { Dialog } from "quasar"
import MediaViewer from "src/components/dialogs/MediaViewer.vue"
import type { MediaGalleryMeta } from "src/components/MediaGallery.vue"
type Props = InstanceType<typeof MediaViewer>["$props"]

const mediaViwer = {
  show(mediaObjects: MediaGalleryMeta[], startIndex = 0, allowDelete = true) {
    const componentProps: Props = {
      mediaObjects,
      startIndex,
      allowDelete,
    }
    return new Promise<void>((res) => {
      Dialog.create({
        component: MediaViewer,
        maximized: true,
        componentProps,
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
export default mediaViwer
