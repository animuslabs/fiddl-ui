import { Dialog } from "quasar"
import type { DialogChainObject } from "quasar"
import MediaCommentsDialog from "components/dialogs/MediaCommentsDialog.vue"

type CommentsDialogProps = InstanceType<typeof MediaCommentsDialog>["$props"]

interface ShowCommentsDialogOptions extends CommentsDialogProps {
  maximized: boolean
  onDismiss?: () => void
}

let activeCommentsDialog: DialogChainObject | null = null
let lastOnDismiss: (() => void) | undefined

export function showCommentsDialog(options: ShowCommentsDialogOptions): DialogChainObject {
  const { maximized, onDismiss, ...componentProps } = options
  lastOnDismiss = onDismiss
  if (activeCommentsDialog) {
    activeCommentsDialog.update({
      maximized,
      componentProps,
    })
    return activeCommentsDialog
  }
  const dialog = Dialog.create({
    component: MediaCommentsDialog,
    componentProps,
    maximized,
  })
  activeCommentsDialog = dialog
  dialog.onDismiss(() => {
    activeCommentsDialog = null
    const handler = lastOnDismiss
    lastOnDismiss = undefined
    handler?.()
  })
  return dialog
}

export function closeCommentsDialog(): void {
  activeCommentsDialog?.hide()
}

export function getActiveCommentsDialog(): DialogChainObject | null {
  return activeCommentsDialog
}
