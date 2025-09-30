<template lang="pug">
q-item.media-comment-item(dense :class="{ 'media-comment-item--highlight': highlighted }")
  q-item-section(avatar)
    q-avatar.comment-avatar(size="36px" color="primary" text-color="white")
      q-img(
        v-if="avatarSrc"
        :src="avatarSrc"
        alt="comment author avatar"
        no-spinner
        ratio="1"
        @error="onAvatarError"
      )
      template(v-else) {{ authorInitial }}
  q-item-section
    .media-comment-meta.row.items-center.no-wrap
      span.media-comment-author.text-subtitle2.text-white {{ authorDisplayName }}
      span.media-comment-timestamp.text-caption.text-grey-4.q-ml-sm {{ timestampLabel }}
      span.text-caption.text-grey-5.q-ml-sm(v-if="comment.edited") (edited)
      q-space
      q-btn.comment-options-btn.q-ml-xs(
        v-if="canManage"
        flat
        dense
        round
        icon="more_vert"
        color="grey-5"
        :loading="actionLoading"
        :disable="actionLoading"
      )
        q-menu(auto-close cover anchor="bottom right" self="top right" class="comment-options-menu")
          q-list(dense padding)
            q-item(clickable v-close-popup @click="$emit('edit')")
              q-item-section Edit
            q-item(clickable v-close-popup class="text-negative" @click="$emit('delete')")
              q-item-section Delete
      q-btn.comment-reply-btn(
        flat
        dense
        no-caps
        size="sm"
        color="primary"
        label="Reply"
        :disable="!comment.author?.username"
        @click.stop="$emit('reply')"
      )
    div.media-comment-content.text-white
      template(v-for="(segment, index) in segments" :key="index")
        RouterLink.media-comment-text.media-comment-mention-link(
          v-if="isMentionLink(segment)"
          :to="segmentProfileLink(segment)"
          :class="[segmentClass(segment), { 'mention-with-tooltip': Boolean(segmentTooltip(segment)) }]"
        )
          | {{ segment.text }}
          q-tooltip(v-if="segmentTooltip(segment)" anchor="bottom middle" self="top middle") {{ segmentTooltip(segment) }}
        span.media-comment-text(
          v-else
          :class="[segmentClass(segment), { 'mention-with-tooltip': Boolean(segmentTooltip(segment)) }]"
        )
          | {{ segment.text }}
          q-tooltip(v-if="segmentTooltip(segment)" anchor="bottom middle" self="top middle") {{ segmentTooltip(segment) }}
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { RouterLink, type RouteLocationRaw } from "vue-router"
import { avatarImg } from "src/lib/netlifyImg"
import {
  buildSegments,
  formatTimestamp,
  segmentClass,
  segmentTooltip,
  type CommentSegment,
  type CommentViewModel,
} from "./commentUtils"

interface Props {
  comment: CommentViewModel
  highlighted: boolean
  canManage: boolean
  actionLoading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "edit"): void
  (e: "delete"): void
  (e: "reply"): void
}>()

const avatarFailed = ref(false)

const authorInitial = computed(() => {
  const username = props.comment.author?.username || "?"
  return username.charAt(0).toUpperCase() || "?"
})

const authorDisplayName = computed(() => {
  const username = props.comment.author?.username
  return username ? `@${username}` : "Unknown user"
})

const timestampLabel = computed(() => formatTimestamp(props.comment.createdAt))

const mentionLookup = computed(() => {
  const map = new Map<string, string>()
  ;(props.comment.mentions || []).forEach((mention) => {
    if (mention?.username) map.set(mention.username.toLowerCase(), mention.username)
  })
  return map
})

const segments = computed<CommentSegment[]>(() =>
  buildSegments(props.comment.decodedContent, (handle) => {
    const username = mentionLookup.value.get(handle) ?? null
    return {
      status: username ? "valid" : null,
      username,
    }
  }),
)

const avatarSrc = computed(() => {
  if (avatarFailed.value) return ""
  const authorId = props.comment.author?.id ?? props.comment.userId ?? ""
  return authorId ? avatarImg(String(authorId)) : ""
})

function onAvatarError() {
  avatarFailed.value = true
}

function isMentionLink(segment: CommentSegment) {
  return Boolean(segment.isMention && segment.status === "valid" && segment.username)
}

function segmentProfileLink(segment: CommentSegment): RouteLocationRaw {
  if (!segment.username || !segment.isMention || segment.status !== "valid") {
    throw new Error("Attempted to build profile link for invalid mention segment")
  }
  return {
    name: "profile",
    params: { username: segment.username },
  }
}
</script>

<style scoped>
.media-comment-item {
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  transition: background 0.2s ease, transform 0.2s ease;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.media-comment-item--highlight {
  background: rgba(128, 222, 234, 0.18);
  border-radius: 16px;
}

.media-comment-meta {
  column-gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
  align-items: center;
  min-width: 0;
}

.media-comment-author {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-comment-timestamp {
  font-size: 0.72rem;
  white-space: nowrap;
  opacity: 0.75;
  flex: 0 1 auto;
  max-width: 25ch;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-comment-content {
  margin-top: 4px;
}

.media-comment-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 1rem;
  background: transparent;
  color: inherit;
  border: none;
}

.media-comment-mention {
  font-weight: 600;
}

.media-comment-mention-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.media-comment-mention-link:hover,
.media-comment-mention-link:focus {
  text-decoration: underline;
}

.comment-avatar :deep(img) {
  object-fit: cover;
}

.comment-reply-btn {
  min-width: 0;
  padding: 0 6px;
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .media-comment-item {
    padding: 10px 14px;
    border-radius: 14px;
  }

  .media-comment-meta {
    column-gap: 6px;
    min-width: 0;
  }

  .media-comment-timestamp {
    font-size: 0.64rem;
    max-width: 18ch;
  }
}

.mention-valid,
.mention-invalid,
.mention-loading {
  font-weight: 600;
}

.mention-with-tooltip {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
</style>
