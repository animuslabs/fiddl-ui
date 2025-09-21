import { computed, nextTick, onMounted, ref, watch, type Ref } from "vue"
import { Dialog, useQuasar } from "quasar"
import { useRouter } from "vue-router"
import type { CommentsCreateBody, CommentsList200CommentsItem } from "src/lib/orval"
import { commentsCreate, commentsDelete, commentsEdit, commentsList } from "src/lib/orval"
import { catchErr } from "src/lib/util"
import { useUserAuth } from "src/stores/userAuth"
import {
  extractMentionHandles,
  normalizeComment,
  type CommentViewModel,
} from "./commentUtils"

export type DialogEmit = {
  (e: "ok", payload: CommentsList200CommentsItem): void
  (e: "hide"): void
}

type ComposerRef = Ref<{ focus: () => void } | null>

type Props = {
  mediaId: string
  mediaType: "image" | "video"
  previewUrl?: string | null
  targetCommentId?: string | null
}

type UseDialogContext = {
  comments: Ref<CommentViewModel[]>
  listLoading: Ref<boolean>
  listError: Ref<string | null>
  submitting: Ref<boolean>
  newComment: Ref<string>
  hasMore: Ref<boolean>
  editingCommentId: Ref<string | null>
  deletingCommentId: Ref<string | null>
  focusCommentId: Ref<string | null>
  currentUserId: Ref<string | null>
  initialLoading: Ref<boolean>
  loadingMore: Ref<boolean>
  submitDisabled: Ref<boolean>
  isMobile: Ref<boolean>
  previewMediaUrl: Ref<string>
  showPreview: Ref<boolean>
  dialogCardStyle: Ref<Record<string, string>>
  commentCountLabel: Ref<string>
  loadMore: () => Promise<void>
  submitComment: () => Promise<void>
  replyToComment: (comment: CommentViewModel) => void
  onEditComment: (comment: CommentViewModel) => void
  onDeleteComment: (comment: CommentViewModel) => void
  canManageComment: (comment: CommentViewModel) => boolean
}

export function useMediaCommentsDialog(
  props: Props,
  emit: DialogEmit,
  composerRef: ComposerRef,
  hide: () => void,
): UseDialogContext {
  const quasar = useQuasar()
  const userAuth = useUserAuth()
  const router = useRouter()

  const comments = ref<CommentViewModel[]>([])
  const listLoading = ref(false)
  const listError = ref<string | null>(null)
  const submitting = ref(false)
  const newComment = ref("")
  const hasMore = ref(false)
  const beforeCursor = ref<string | null>(null)
  const editingCommentId = ref<string | null>(null)
  const deletingCommentId = ref<string | null>(null)
  const focusCommentId = ref<string | null>(props.targetCommentId ?? null)

  const pageSize = 20
  const currentUserId = computed(() => (userAuth.userId ? String(userAuth.userId) : null))
  const initialLoading = computed(() => listLoading.value && comments.value.length === 0)
  const loadingMore = computed(() => listLoading.value && comments.value.length > 0)
  const submitDisabled = computed(() => submitting.value || newComment.value.trim().length === 0)
  const isMobile = computed(() => quasar.screen.lt.md)
  const previewMediaUrl = computed(() => props.previewUrl ?? "")
  const showPreview = computed(() => Boolean(previewMediaUrl.value) && ["image", "video"].includes(props.mediaType))

  const dialogCardStyle = computed(() => {
    if (isMobile.value) return {}
    const baseWidth = showPreview.value ? "92vw" : "78vw"
    const maxWidth = showPreview.value ? "1440px" : "960px"
    const minWidth = showPreview.value ? "960px" : "640px"
    return {
      width: baseWidth,
      maxWidth,
      minWidth,
    }
  })

  const commentCountLabel = computed(() => {
    if (initialLoading.value) return ""
    const count = comments.value.length
    if (!count) return ""
    return count === 1 ? "1 comment" : `${count} comments`
  })

  onMounted(() => {
    void loadComments(true)
  })

  watch(
    () => [props.mediaId, props.mediaType],
    () => {
      comments.value = []
      beforeCursor.value = null
      listError.value = null
      focusCommentId.value = props.targetCommentId ?? null
      void loadComments(true)
    },
  )

  watch(
    () => props.targetCommentId,
    (value) => {
      focusCommentId.value = value ?? null
    },
  )

  async function loadComments(initial = false) {
    if (!props.mediaId) return
    if (listLoading.value) return
    listLoading.value = true
    if (initial) {
      beforeCursor.value = null
      listError.value = null
    }
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
      }
      if (props.mediaType === "image") params.imageId = props.mediaId
      else params.videoId = props.mediaId
      if (!initial && beforeCursor.value) params.before = beforeCursor.value

      const response = await commentsList(params)
      const fetched = response.data.comments || []
      const normalized = fetched.map(normalizeComment)

      if (initial) comments.value = normalized
      else comments.value = [...comments.value, ...normalized]

      hasMore.value = fetched.length === pageSize
      beforeCursor.value = hasMore.value && fetched.length ? (fetched[fetched.length - 1]?.createdAt ?? null) : null
    } catch (err: any) {
      console.error(err)
      listError.value = err?.response?.data?.message || err?.message || "Failed to load comments"
    } finally {
      listLoading.value = false
    }
  }

  async function loadMore() {
    await loadComments(false)
  }

  async function submitComment() {
    if (submitDisabled.value) return
    if (!userAuth.loggedIn) {
      Dialog.create({
        title: "Login required",
        message: "You need to login to leave a comment.",
        cancel: { flat: true, label: "Cancel" },
        ok: { label: "Login", color: "primary" },
        persistent: true,
      }).onOk(() => {
        void router.push({ name: "login" })
        hide()
      })
      return
    }

    const content = newComment.value.trim()
    if (!content) return

    submitting.value = true
    try {
      const payload: CommentsCreateBody = { content }
      if (props.mediaType === "image") payload.imageId = props.mediaId
      else payload.videoId = props.mediaId

      const { data } = await commentsCreate(payload)
      const created = normalizeComment(data)
      comments.value = [created, ...comments.value]
      newComment.value = ""
      focusCommentId.value = created.id
      emit("ok", created)
    } catch (err) {
      catchErr(err)
    } finally {
      submitting.value = false
    }
  }

  function replyToComment(comment: CommentViewModel) {
    const username = comment.author?.username
    if (!username) return
    const handle = username.toLowerCase()
    const existingHandles = extractMentionHandles(newComment.value)
    const mentionToken = `@${username}`

    let updated = newComment.value
    if (!existingHandles.includes(handle)) {
      const trimmed = updated.trimStart()
      updated = trimmed.length ? `${mentionToken} ${trimmed}` : `${mentionToken} `
    }
    if (!updated.endsWith(" ")) updated += " "
    newComment.value = updated

    void nextTick(() => {
      composerRef.value?.focus()
    })
  }

  function onEditComment(comment: CommentViewModel) {
    if (!canManageComment(comment)) return
    const initial = comment.decodedContent
    Dialog.create({
      title: "Edit comment",
      message: "Update your comment below.",
      prompt: {
        model: initial,
        type: "textarea",
        counter: true,
        maxlength: 500,
        isValid: (value: string) => typeof value === "string" && value.trim().length > 0,
      },
      cancel: { flat: true, label: "Cancel" },
      ok: { label: "Save", color: "primary" },
      persistent: true,
    }).onOk((value) => {
      const nextValue = typeof value === "string" ? value.trim() : ""
      if (!nextValue) return
      if (nextValue === comment.decodedContent.trim()) return
      void updateComment(comment.id, nextValue)
    })
  }

  async function updateComment(commentId: string, content: string) {
    editingCommentId.value = commentId
    try {
      const { data } = await commentsEdit({ commentId, content })
      const updated = normalizeComment(data)
      comments.value = comments.value.map((existing) => (existing.id === commentId ? updated : existing))
      focusCommentId.value = commentId
      quasar.notify({ type: "positive", message: "Comment updated" })
    } catch (err) {
      catchErr(err)
    } finally {
      editingCommentId.value = null
    }
  }

  function onDeleteComment(comment: CommentViewModel) {
    if (!canManageComment(comment)) return
    Dialog.create({
      title: "Delete comment",
      message: "Are you sure you want to delete this comment? This action cannot be undone.",
      cancel: { flat: true, label: "Cancel" },
      ok: { label: "Delete", color: "negative" },
      persistent: true,
    }).onOk(() => {
      void deleteComment(comment.id)
    })
  }

  async function deleteComment(commentId: string) {
    deletingCommentId.value = commentId
    try {
      await commentsDelete({ commentId })
      comments.value = comments.value.filter((existing) => existing.id !== commentId)
      if (focusCommentId.value === commentId) focusCommentId.value = null
      quasar.notify({ type: "positive", message: "Comment deleted" })
    } catch (err) {
      catchErr(err)
    } finally {
      deletingCommentId.value = null
    }
  }

  function canManageComment(comment: CommentViewModel) {
    const currentUser = currentUserId.value
    if (!currentUser) return false
    const rawAuthorId = comment.author?.id ?? comment.userId ?? ""
    const authorId = rawAuthorId ? String(rawAuthorId) : ""
    return Boolean(authorId) && currentUser === authorId
  }

  return {
    comments,
    listLoading,
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
    canManageComment,
  }
}
