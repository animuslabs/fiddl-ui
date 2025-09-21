<template lang="pug">
div
  div.media-comments-loading(v-if="initialLoading")
    q-spinner(size="32px" color="primary")
  template(v-else)
    q-banner.bg-negative.text-white(v-if="listError") {{ listError }}
    q-scroll-area.media-comments-scroll(ref="scrollAreaRef" :style="scrollAreaStyle")
      div.q-pa-md
        div(v-if="comments.length")
          q-list(separator)
            MediaCommentItem(
              v-for="comment in comments"
              :key="comment.id"
              :ref="(el) => registerCommentRef(comment.id, el)"
              :comment="comment"
              :highlighted="highlightedCommentId === comment.id"
              :can-manage="canManageComment(comment)"
              :action-loading="isCommentActionLoading(comment.id)"
              @edit="$emit('edit', comment)"
              @delete="$emit('delete', comment)"
              @reply="$emit('reply', comment)"
            )
        div.text-body2.text-grey-4.text-center(v-else) No comments yet. Be the first to share your thoughts.
    div.flex.justify-center.q-mt-sm(v-if="loadingMore")
      q-spinner(size="24px" color="primary")
    div.flex.justify-center.q-pa-sm(v-if="hasMore && !loadingMore")
      q-btn(flat color="primary" label="Load older" @click="$emit('load-more')")
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from "vue"
import { QScrollArea } from "quasar"
import {
  type CommentViewModel,
} from "./commentUtils"
import MediaCommentItem from "./MediaCommentItem.vue"

interface Props {
  comments: CommentViewModel[]
  listError: string | null
  initialLoading: boolean
  loadingMore: boolean
  hasMore: boolean
  isMobile: boolean
  focusCommentId: string | null
  currentUserId: string | null
  editingCommentId: string | null
  deletingCommentId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "load-more"): void
  (e: "edit", comment: CommentViewModel): void
  (e: "delete", comment: CommentViewModel): void
  (e: "reply", comment: CommentViewModel): void
  (e: "focus-handled"): void
}>()

const scrollAreaRef = ref<InstanceType<typeof QScrollArea> | null>(null)
const DESKTOP_SCROLL_HEIGHT = "55vh"

const scrollAreaStyle = computed(() => {
  if (props.isMobile) {
    return {
      flex: "1 1 0",
      height: "100%",
      maxHeight: "100%",
      minHeight: "0",
      width: "100%",
    }
  }
  return {
    height: DESKTOP_SCROLL_HEIGHT,
    maxHeight: DESKTOP_SCROLL_HEIGHT,
    minHeight: "200px",
    width: "100%",
  }
})

const commentItemRefs = new Map<string, HTMLElement>()
const pendingFocusId = ref<string | null>(props.focusCommentId)
const highlightedCommentId = ref<string | null>(null)

watch(
  () => props.focusCommentId,
  (value) => {
    pendingFocusId.value = value
    if (value) void attemptHighlight()
  },
)

watch(
  () => props.loadingMore,
  (loading) => {
    if (!loading) void attemptHighlight()
  },
)

watch(
  () => props.comments.length,
  () => {
    void attemptHighlight()
  },
)

function isCommentActionLoading(commentId: string) {
  return props.editingCommentId === commentId || props.deletingCommentId === commentId
}

function canManageComment(comment: CommentViewModel) {
  if (!props.currentUserId) return false
  const rawAuthorId = comment.author?.id ?? comment.userId ?? ""
  const authorId = rawAuthorId ? String(rawAuthorId) : ""
  return Boolean(authorId && props.currentUserId === authorId)
}

function resolveCommentElement(el: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (!el) return null
  if (el instanceof HTMLElement) return el
  const maybeEl = (el as ComponentPublicInstance).$el
  return maybeEl instanceof HTMLElement ? maybeEl : null
}

function registerCommentRef(commentId: string, el: Element | ComponentPublicInstance | null) {
  const element = resolveCommentElement(el)
  if (!element) {
    commentItemRefs.delete(commentId)
    return
  }
  commentItemRefs.set(commentId, element)
  if (pendingFocusId.value === commentId && !props.loadingMore) {
    void attemptHighlight()
  }
}

async function attemptHighlight() {
  const targetId = pendingFocusId.value
  if (!targetId) return
  if (props.loadingMore) return
  await nextTick()
  const element = commentItemRefs.get(targetId)
  if (!element) return
  highlightedCommentId.value = targetId
  pendingFocusId.value = null
  emit("focus-handled")
  scrollToComment(element)
}

function scrollToComment(element: HTMLElement) {
  const scrollArea = scrollAreaRef.value
  if (!scrollArea) {
    element.scrollIntoView({ block: "center", behavior: "smooth" })
    return
  }
  const scrollApi = scrollArea as any
  const target = scrollApi?.getScrollTarget?.()
  if (!target || !(target instanceof HTMLElement)) {
    element.scrollIntoView({ block: "center", behavior: "smooth" })
    return
  }
  const containerRect = target.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const currentScrollTop = target.scrollTop || 0
  const offset = elementRect.top - containerRect.top + currentScrollTop - 48
  if (typeof scrollApi?.setScrollPosition === "function") {
    scrollApi.setScrollPosition("vertical", Math.max(offset, 0), 320)
  } else {
    target.scrollTo({ top: Math.max(offset, 0), behavior: "smooth" })
  }
}

</script>

<style scoped>
.media-comments-scroll {
  width: 100%;
  flex: 1 1 auto;
}

.media-comments-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.media-comment-item + .media-comment-item {
  margin-top: 4px;
}
</style>
