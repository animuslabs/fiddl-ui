<template lang="pug">
q-dialog(ref="dialogRef" @hide="onDialogHide" :maximized="isMobile" style="overflow:hidden")
  q-card.q-dialog-plugin.media-comments-dialog(:class="{ 'media-comments-dialog--mobile': isMobile, 'media-comments-dialog--with-preview': showPreview }" :style="dialogCardStyle")
    q-card-section.media-comments-header
      .row.items-start.justify-between
        .col-auto
          div.text-h6 Comments
          div.text-caption.text-grey-6(v-if="commentCountLabel") {{ commentCountLabel }}
        q-btn(flat dense round icon="close" color="grey-5" @click="hide")
    q-card-section.media-comments-body-section.q-pa-none
      div.media-comments-body(:class="{ 'media-comments-body--with-preview': showPreview }")
        MediaCommentsPreview(v-if="showPreview" :media-type="props.mediaType" :preview-url="previewMediaUrl")
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
.media-comments-dialog {
  width: min(720px, 95vw);
  max-height: 90vh;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
}

.media-comments-dialog--with-preview {
  width: min(1440px, 96vw);
}

.media-comments-dialog--mobile {
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  max-height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  min-height: 0;
  border-radius: 0;
}

.media-comments-header {
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  flex-shrink: 0;
  padding: 16px;
}

.media-comments-dialog--mobile .media-comments-header {
  padding: 10px 16px;
}

.media-comments-body-section {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

.media-comments-body {
  min-height: 160px;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.media-comments-body--with-preview {
  flex-direction: row;
  gap: 16px;
}

.media-comments-dialog--mobile .media-comments-body--with-preview {
  flex-direction: column;
  gap: 12px;
}

.media-comments-main {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.media-comments-input {
  padding-bottom: 16px;
  flex-shrink: 0;
}

.media-comments-dialog--mobile .media-comments-input {
  padding-bottom: 24px;
}
</style>
