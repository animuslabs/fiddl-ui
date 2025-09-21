import { Dialog } from "quasar"
import MediaViewer from "src/components/dialogs/MediaViewer.vue"
import type { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { usePopularityStore } from "src/stores/popularityStore"

export const COMMENT_DIALOG_SENTINEL = "__media_viewer_open_comments__"
type Props = InstanceType<typeof MediaViewer>["$props"]

interface MediaViewerShowOptions {
  requestId?: string
  initialCommentId?: string | null
}

const mediaViwer = {
  show(mediaObjects: MediaGalleryMeta[], startIndex = 0, allowDelete = true, options: MediaViewerShowOptions = {}) {
    const componentProps: Props = {
      mediaObjects,
      startIndex,
      allowDelete,
      requestId: options.requestId,
      initialCommentId: options.initialCommentId ?? undefined,
    }
    try {
      const popularity = usePopularityStore()
      const items: { id: string; mediaType: "image" | "video" }[] = mediaObjects.map((m) => ({
        id: m.id,
        mediaType: m.type === "video" || m.mediaType === "video" ? "video" : "image",
      }))
      void popularity.fetchBatchByItems(items)
    } catch (e) {
      console.error("[mediaViewer] failed to prefetch popularity", e)
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
