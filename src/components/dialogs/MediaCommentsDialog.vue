<template lang="pug">
q-dialog.media-comments-shell(ref="dialogRef" @hide="onDialogHide" :maximized="isMobile" style="overflow:hidden")
  q-card.media-comments-card(:class="{ 'media-comments-card--mobile': isMobile }" :style="isMobile ? undefined : dialogCardStyle")
    q-card-section.media-comments-header
      .row.items-start.justify-between
        .col-auto
          div.text-h6 Comments
          div.text-caption.text-grey-6(v-if="commentCountLabel") {{ commentCountLabel }}
        q-btn(flat dense round icon="close" color="grey-5" @click="hide")
    q-card-section.media-comments-body-section.q-pa-none
      div.media-comments-body(:class="{ 'media-comments-body--with-preview': showPreview && !isMobile }")
        MediaCommentsPreview(v-if="showPreview" :media-type="props.mediaType" :preview-url="previewMediaUrl" :is-mobile="isMobile")
        div.media-comments-main
          MediaCommentsList(
            :comments="comments"
            :list-error="listError"
            :initial-loading="initialLoading"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :is-mobile="isMobile"
            :focus-comment-id="focusCommentId"
            :current-user-id="currentUserId"
            :editing-comment-id="editingCommentId"
            :deleting-comment-id="deletingCommentId"
            @load-more="loadMore"
            @edit="onEditComment"
            @delete="onDeleteComment"
            @reply="replyToComment"
            @focus-handled="focusCommentId = null"
          )
    q-separator
    q-card-section.media-comments-input
      MediaCommentComposer(
        ref="composerRef"
        v-model="newComment"
        :submitting="submitting"
        :submit-disabled="submitDisabled"
        :placeholder="commentPlaceholder"
        @submit="submitComment"
      )
</template>

<script setup lang="ts">
import { ref } from "vue"
import { QDialog } from "quasar"
import type { CommentsList200CommentsItem } from "src/lib/orval"
import MediaCommentComposer from "./media-comments/MediaCommentComposer.vue"
import MediaCommentsList from "./media-comments/MediaCommentsList.vue"
import MediaCommentsPreview from "./media-comments/MediaCommentsPreview.vue"
import { useMediaCommentsDialog, type DialogEmit } from "./media-comments/useMediaCommentsDialog"

interface Props {
  mediaId: string
  mediaType: "image" | "video"
  previewUrl?: string | null
  targetCommentId?: string | null
  forceMobileLayout?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  ok: [CommentsList200CommentsItem]
  hide: []
}>()

const commentPlaceholder = "Leave a comment"
const dialogRef = ref<QDialog | null>(null)
const composerRef = ref<{ focus: () => void } | null>(null)

const hide = () => {
  dialogRef.value?.hide()
}

const {
  comments,
  listError,
  submitting,
  newComment,
  hasMore,
  editingCommentId,
  deletingCommentId,
  focusCommentId,
  currentUserId,
  initialLoading,
  loadingMore,
  submitDisabled,
  isMobile,
  previewMediaUrl,
  showPreview,
  dialogCardStyle,
  commentCountLabel,
  loadMore,
  submitComment,
  replyToComment,
  onEditComment,
  onDeleteComment,
} = useMediaCommentsDialog(props, emit as DialogEmit, composerRef, hide)

function onDialogHide() {
  emit("hide")
}

function show() {
  dialogRef.value?.show()
}

defineExpose({
  show,
  hide,
})
</script>

<style scoped>
.media-comments-card {
  width: min(960px, 95vw);
  max-height: 90vh;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
}

.media-comments-card--mobile {
  width: 100vw;
  max-width: 100vw;
  /* Use dynamic viewport height on modern browsers to avoid cutoff under mobile address bars */
  height: 100vh;
  height: 100dvh;
  max-height: 100vh;
  max-height: 100dvh;
  border-radius: 0;
}

.media-comments-header {
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  flex-shrink: 0;
  padding: 16px;
}

.media-comments-card--mobile .media-comments-header {
  /* Add safe-area top padding for notched devices */
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
}

:deep(.media-comments-shell.q-dialog--maximized) {
  /* Ensure the fixed dialog uses dynamic viewport height on mobile */
  height: 100vh;
  height: 100dvh;
}

:deep(.media-comments-shell.q-dialog--maximized .q-dialog__inner) {
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
  min-height: 100vh;
  min-height: 100dvh;
}

:deep(.media-comments-shell.q-dialog--maximized .q-dialog__inner > *) {
  flex: 1 1 auto;
  max-width: none;
  width: 100%;
  height: 100%;
}

.media-comments-body-section {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding: 0;
  min-height: 0;
}


.media-comments-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 0 16px 16px;
}

.media-comments-body--with-preview {
  flex-direction: row;
}

.media-comments-card--mobile .media-comments-body {
  padding: 0 12px 12px;
  gap: 10px;
  overflow: hidden;
}

.media-comments-main {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.media-comments-card--mobile .media-comments-main {
  overflow: hidden;
}

.media-comments-input {
  padding: 0 16px 16px;
  flex-shrink: 0;
}

.media-comments-card--mobile .media-comments-input {
  /* Respect safe-area (iOS) and ensure composer isn't hidden behind system UI */
  padding: 0 12px calc(16px + env(safe-area-inset-bottom, 0px));
}
</style>
