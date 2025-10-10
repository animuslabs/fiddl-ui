<template lang="pug">
q-page.q-pa-md
  // Header row
  .row.items-center.justify-between.q-mx-auto(style="max-width:1200px; width:100%")
    .row.items-center.q-gutter-sm
      h5.q-mr-sm Notifications
      q-badge(v-if="unreadCount > 0" color="red" :label="String(unreadCount) + ' unread'")
    .row.items-center.q-gutter-sm
      q-btn(flat icon="refresh" label="Refresh" @click="refresh" :loading="loading")
      q-btn(flat icon="done_all" label="Mark all seen" @click="markAllSeen" :disable="unreadCount === 0" :loading="loading")

  // Filters and list container
  .q-mx-auto.q-mt-md(style="max-width:1200px; width:100%")
    .row.items-center.q-gutter-md.q-mb-md
      q-toggle(v-model="showUnseenOnly" label="Show unseen only")
      q-toggle(v-model="showOwnActivity" label="Show my activity")
      q-toggle(v-model="includeErrors" label="Include critical errors")
      q-select(
        v-model="selectedTypes"
        label="Types"
        :options="typeOptions"
        emit-value
        map-options
        multiple
        use-chips
        dense
        options-dense
        clearable
        :clear-value="[]"
        style="min-width:260px"
      )

    q-linear-progress(v-if="loading" indeterminate color="primary")

    q-list(v-if="paginatedEvents.length > 0")
      q-item(
        v-for="ev in paginatedEvents"
        :key="ev.id"
        clickable
        @click="handleClick(ev)"
        :class="ev.seen ? '' : 'bg-grey-10'"
      )
        q-item-section(avatar)
          q-avatar(:size="isMobile ? '32px' : '40px'" square)
            q-img(:src="previewFor(ev)" :ratio="1" no-spinner)
        q-item-section
          .row.items-start.justify-between(:style="{ gap: '8px' }")
            .column(:style="{ flex: '1 1 0', minWidth: 0 }")
              .text-body2(:style="{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }")
                template(v-if="ev.originUsername && hasUserInMessage(ev)")
                  router-link(:to="{ name: 'profile', params: { username: ev.originUsername } }" class="notif-link") @{{ ev.originUsername }}
                  |  {{ actionTextFor(ev) }}
                template(v-else) {{ messageFor(ev) }}
              .notif-comment-preview.text-caption.q-mt-xs(v-if="commentPreview(ev)")
                span.notif-comment-link(@click.stop="openCommentFromEvent(ev)") {{ commentPreview(ev) }}
            .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
        q-item-section(side)
          q-btn(flat round dense size="sm" :icon="ev.seen ? 'check' : 'mark_email_unread'" :color="ev.seen ? 'positive' : 'primary'" @click.stop="toggleSeen(ev)")
    div(v-else).centered.q-pa-lg
      .text-grey-6 No notifications found

    .row.justify-center.q-my-lg
      q-pagination(
        v-model="page"
        :max="pageCount"
        boundary-numbers
        direction-links
        :max-pages="7"
        color="primary"
        size="md"
      )
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { eventsPrivateEvents, eventsMarkEventSeen, EventsPrivateEvents200ItemType as EventsTypeConst, type EventsPrivateEvents200Item, type EventsPrivateEventsParams, type EventsPrivateEvents200ItemType } from "../lib/orval"
import { img, s3Video } from "../lib/netlifyImg"
import mediaViwer from "../lib/mediaViewer"
import { emitNotificationsSeen, listenNotificationsSeen } from "../lib/notificationsBus"
import { decodeHtmlEntities } from "../lib/util"

const ALL_TYPES = Object.values(EventsTypeConst) as EventsPrivateEvents200ItemType[]

export default defineComponent({
  name: "EventsPage",
  data() {
    return {
      loading: false as boolean,
      events: [] as EventsPrivateEvents200Item[],
      page: 1 as number,
      pageSize: 20 as number,
      showUnseenOnly: false as boolean,
      showOwnActivity: false as boolean,
      includeErrors: false as boolean,
      selectedTypes: [] as EventsPrivateEvents200ItemType[],
      typeOptions: ALL_TYPES.map((t) => ({ label: t, value: t })),
      seenCleanup: null as null | (() => void),
    }
  },
  computed: {
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return window.matchMedia("(max-width: 1023px)").matches
    },
    unreadCount(): number {
      return this.events.filter((e) => !e.seen).length
    },
    filtered(): EventsPrivateEvents200Item[] {
      let arr = this.events
      if (!this.includeErrors) arr = arr.filter((e) => e.type !== "asyncError")
      if (this.showUnseenOnly) arr = arr.filter((e) => !e.seen)
      if (!this.showOwnActivity) arr = arr.filter((e) => !this.isOwnEvent(e))
      if (this.selectedTypes.length > 0) arr = arr.filter((e) => this.selectedTypes.includes(e.type))
      return arr
    },
    sorted(): EventsPrivateEvents200Item[] {
      return [...this.filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },
    pageCount(): number {
      return Math.max(1, Math.ceil(this.sorted.length / this.pageSize))
    },
    paginatedEvents(): EventsPrivateEvents200Item[] {
      const start = (this.page - 1) * this.pageSize
      return this.sorted.slice(start, start + this.pageSize)
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val: boolean) {
        if (val) void this.refresh()
        else this.events = []
      },
    },
    selectedTypes() {
      this.page = 1
    },
    showUnseenOnly() {
      this.page = 1
    },
    includeErrors() {
      // refetch when toggling inclusion to be efficient server-side
      void this.refresh()
      this.page = 1
    },
    // Keep page in range when filters change
    sorted() {
      if (this.page > this.pageCount) this.page = this.pageCount
    },
  },
  mounted() {
    if (this.$userAuth.loggedIn) void this.refresh()
    this.seenCleanup = listenNotificationsSeen(this.onExternalSeen)
  },
  beforeUnmount() {
    if (this.seenCleanup) {
      this.seenCleanup()
      this.seenCleanup = null
    }
  },
  methods: {
    nonErrorTypes(): string[] {
      const ALL = Object.values(EventsTypeConst) as string[]
      return ALL.filter((t) => t !== "asyncError")
    },
    isOwnEvent(ev: EventsPrivateEvents200Item): boolean {
      // Show critical errors regardless of the "Show my activity" toggle
      if (ev.type === "asyncError") return false
      const uid = this.$userAuth?.userId
      if (!uid) return false
      return ev.originUserId === uid
    },
    onExternalSeen(ids: string[]) {
      if (!Array.isArray(ids) || ids.length === 0) return
      const idSet = new Set(ids)
      this.events.forEach((event) => {
        if (!event.seen && idSet.has(event.id)) {
          event.seen = true
        }
      })
    },
    parseData(ev: EventsPrivateEvents200Item): any {
      try {
        return JSON.parse(ev.dataJSON)
      } catch {
        return null
      }
    },
    previewFor(ev: EventsPrivateEvents200Item): string {
      const data = this.parseData(ev) || {}
      const mediaType = data.mediaType || data.media_type
      const mediaId = data.mediaId || data.media_id
      const imageId = data.imageId || data.image_id || (mediaType === "image" ? mediaId : undefined)
      const videoId = data.videoId || data.video_id || (mediaType === "video" ? mediaId : undefined)
      if (imageId) return img(String(imageId), "md")
      if (videoId) return s3Video(String(videoId), "thumbnail")
      return "/blankAvatar.webp"
    },
    async refresh() {
      if (!this.$userAuth.loggedIn) return
      this.loading = true
      try {
        let since: string | undefined
        if (this.events.length > 0) {
          const times = this.events.map((e) => new Date(e.createdAt).getTime())
          const sinceTs = times.length ? Math.max(...times) : 0
          if (sinceTs > 0) since = new Date(sinceTs).toISOString()
        }
        const baseParams: EventsPrivateEventsParams = {
          limit: 200,
          includeSeen: true,
          // Server expects CSV string for types
          types: this.includeErrors ? undefined : this.nonErrorTypes().join(","),
        }
        const params = since ? { ...baseParams, since } : baseParams
        const { data } = await eventsPrivateEvents(params)
        let incoming = Array.isArray(data) ? data : []

        if (since && incoming.length === 0) {
          const fullResponse = await eventsPrivateEvents({ ...baseParams })
          incoming = Array.isArray(fullResponse.data) ? fullResponse.data : []
          since = undefined
        }

        // Ensure asyncError is excluded when not requested
        if (!this.includeErrors) incoming = incoming.filter((e) => e.type !== "asyncError")

        // Mark our own activity as seen immediately so it never counts as unread
        try {
          const selfUnseen = incoming.filter((e) => this.isOwnEvent(e) && !e.seen)
          if (selfUnseen.length > 0) {
            // Optimistically mark seen locally
            selfUnseen.forEach((e) => (e.seen = true))
            const ids = selfUnseen.map((e) => e.id)
            void Promise.all(
              selfUnseen.map((e) =>
                eventsMarkEventSeen({ eventId: e.id }).catch(() => undefined),
              ),
            ).then(() => emitNotificationsSeen(ids))
          }
        } catch {
          // ignore
        }

        if (since) {
          const byId = new Map<string, EventsPrivateEvents200Item>()
          ;[...incoming, ...this.events].forEach((e) => byId.set(e.id, e))
          this.events = Array.from(byId.values())
        } else {
          this.events = incoming
        }
        if (this.page > this.pageCount) this.page = this.pageCount
      } finally {
        this.loading = false
      }
    },
    async toggleSeen(ev: EventsPrivateEvents200Item) {
      if (ev.seen) return
      try {
        await eventsMarkEventSeen({ eventId: ev.id })
        ev.seen = true
        emitNotificationsSeen([ev.id])
      } catch (e) {
        // ignore
      }
    },
    async markAllSeen() {
      const unseen = this.events.filter((e) => !e.seen)
      if (unseen.length === 0) return
      this.loading = true
      try {
        const seenIds: string[] = []
        await Promise.all(
          unseen.map(async (e) => {
            try {
              await eventsMarkEventSeen({ eventId: e.id })
              e.seen = true
              seenIds.push(e.id)
            } catch (err) {
              // ignore individual failures
            }
          }),
        )
        if (seenIds.length > 0) emitNotificationsSeen(seenIds)
      } finally {
        this.loading = false
      }
    },
    handleClick(ev: EventsPrivateEvents200Item) {
      if (ev.type === "creationCommented" || ev.type === "commentMentioned") {
        void this.openCommentFromEvent(ev)
      } else {
        void this.toggleSeen(ev)
      }
    },
    iconFor(type: string) {
      if (type.includes("Video")) return "smart_display"
      if (type.includes("Image")) return "image"
      return "notifications"
    },
    hasUserInMessage(ev: EventsPrivateEvents200Item) {
      return String(this.messageFor(ev)).startsWith("@")
    },
    actionTextFor(ev: EventsPrivateEvents200Item) {
      const u = ev.originUsername || "someone"
      switch (ev.type) {
        case "likedImage":
          return "liked your image"
        case "likedVideo":
          return "liked your video"
        case "unlikedImage":
          return "removed their like on your image"
        case "unlikedVideo":
          return "removed their like on your video"
        case "addedImageToCollection":
          return "added your image to a collection"
        case "removedImageFromCollection":
          return "removed your image from a collection"
        case "unlockedImage":
          return "unlocked your image"
        case "unlockedVideo":
          return "unlocked your video"
        case "referredUser":
          return "joined from your referral"
        case "missionCompleted":
          return "Mission completed"
        case "creationCommented": {
          const mediaType = this.commentMediaType(ev)
          return mediaType === "video" ? "commented on your video" : "commented on your image"
        }
        case "commentMentioned": {
          const mediaType = this.commentMediaType(ev)
          return mediaType === "video" ? "mentioned you in a video comment" : "mentioned you in an image comment"
        }
        default:
          return `Activity: ${ev.type}`
      }
    },
    messageFor(ev: EventsPrivateEvents200Item) {
      const u = ev.originUsername || "someone"
      switch (ev.type) {
        case "asyncError": {
          const data = this.parseData(ev) || {}
          const mediaType = (data.mediaType || data.media_type || (data.videoId || data.video_id ? "video" : "image")) as
            | "image"
            | "video"
          const refund =
            data.refund ?? data.refunded ?? data.refundPoints ?? data.refundedPoints ?? data.pointsRefunded ??
            data.refund_points
          const reason = String(data.reason || data.error || data.message || "").trim()
          const base = `Generation failed for your ${mediaType}`
          const refundMsg = typeof refund === "number" && refund > 0 ? ` — refunded ${refund} points` : ""
          const reasonMsg = reason ? ` — ${reason}` : ""
          return `${base}${refundMsg}${reasonMsg}`
        }
        case "likedImage":
          return `@${u} liked your image`
        case "likedVideo":
          return `@${u} liked your video`
        case "unlikedImage":
          return `@${u} removed their like on your image`
        case "unlikedVideo":
          return `@${u} removed their like on your video`
        case "addedImageToCollection":
          return `@${u} added your image to a collection`
        case "removedImageFromCollection":
          return `@${u} removed your image from a collection`
        case "unlockedImage":
          return `@${u} unlocked your image`
        case "unlockedVideo":
          return `@${u} unlocked your video`
        case "referredUser":
          return `@${u} joined from your referral`
        case "missionCompleted":
          return `Mission completed`
        case "creationCommented": {
          const mediaType = this.commentMediaType(ev)
          return `@${u} commented on your ${mediaType}`
        }
        case "commentMentioned": {
          const mediaType = this.commentMediaType(ev)
          const subject = mediaType === "video" ? "video" : "image"
          return `@${u} mentioned you in a ${subject} comment`
        }
        default:
          return `Activity: ${ev.type}`
      }
    },
    commentMediaType(ev: EventsPrivateEvents200Item): "image" | "video" {
      const data = this.parseData(ev) || {}
      const direct = data.mediaType || data.media_type
      if (direct === "video") return "video"
      if (direct === "image") return "image"
      if (data.videoId || data.video_id) return "video"
      return "image"
    },
    commentPreview(ev: EventsPrivateEvents200Item): string {
      if (ev.type !== "creationCommented" && ev.type !== "commentMentioned") return ""
      const data = this.parseData(ev) || {}
      const preview = data.preview || data.commentPreview || data.comment_preview
      if (!preview) return ""
      const raw = String(preview).trim()
      if (!raw) return ""
      const decoded = decodeHtmlEntities(raw)
      if (!decoded) return ""
      if (decoded.length > 160) return `${decoded.slice(0, 157)}…`
      return decoded
    },
    commentPayload(ev: EventsPrivateEvents200Item) {
      if (ev.type !== "creationCommented" && ev.type !== "commentMentioned") return null
      const data = this.parseData(ev) || {}
      const mediaId =
        data.mediaId || data.media_id || data.imageId || data.image_id || data.videoId || data.video_id
      if (!mediaId) return null
      const commentId = data.commentId || data.comment_id || null
      const mediaType = this.commentMediaType(ev)
      return {
        mediaId: String(mediaId),
        mediaType,
        commentId: commentId ? String(commentId) : null,
      }
    },
    async openCommentFromEvent(ev: EventsPrivateEvents200Item) {
      const payload = this.commentPayload(ev)
      if (!payload) {
        await this.toggleSeen(ev)
        return
      }
      await this.toggleSeen(ev)
      const media = { id: payload.mediaId, type: payload.mediaType }
      void mediaViwer.show([media as any], 0, true, { initialCommentId: payload.commentId ?? undefined })
    },
    timeAgo(iso: string) {
      const diff = Date.now() - new Date(iso).getTime()
      const sec = Math.floor(diff / 1000)
      if (sec < 60) return `${sec}s ago`
      const min = Math.floor(sec / 60)
      if (min < 60) return `${min}m ago`
      const hr = Math.floor(min / 60)
      if (hr < 24) return `${hr}h ago`
      const day = Math.floor(hr / 24)
      return `${day}d ago`
    },
  },
})
</script>
