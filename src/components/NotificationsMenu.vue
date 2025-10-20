<template lang="pug">
div.relative-position.self-center
  q-btn(
    round
    flat
    dense
    padding="1px"
    size="md"
    :color="activatorColor"
    :icon="activatorIcon"
    @click="onActivatorClick"
  )
    q-badge(v-if="unreadCount > 0" floating color="red" :label="unreadCount > 99 ? '99+' : String(unreadCount)")
    //- Desktop: anchored dropdown menu
    q-menu(
      v-if="!isMobile"
      v-model="open"
      :anchor="menuAnchor"
      :self="menuSelf"
      :content-style="menuContentStyle"
      @before-show="onBeforeShow"
      transition-duration="0"
    ).notif-surface
      div.q-pa-sm(:style="menuContainerStyle")
        .q-mb-sm.row.items-center.justify-between
          .text-subtitle2 Notifications
          q-btn(flat dense icon="done_all" @click.stop="markAllSeen" :disable="unreadCount === 0" :loading="loading")
            q-tooltip Mark all as seen
        q-separator
        q-scroll-area(:style="menuScrollStyle")
          q-list(v-if="motdShouldRender" :dense="isMobile" class="motd-container")
            q-item(clickable class="items-start notif-item motd-notif" @click.stop="openMotdFromMenu")
              q-item-section(avatar)
                q-avatar(:size="avatarSize")
                  q-icon(name="campaign" :color="motdUnread ? 'primary' : 'grey-5'")
              q-item-section(:style="{ minWidth: 0 }")
                .text-body2.text-weight-medium(:class="{ 'text-primary': motdUnread }") {{ motdTitle }}
                .text-body2.text-grey-3.q-mt-xs {{ motdSummary }}
                .text-caption.text-grey-6(v-if="motdCreatedAt") {{ timeAgo(motdCreatedAt) }}
          q-list(v-if="recentEvents.length > 0" :dense="isMobile")
            q-item(v-for="ev in recentEvents" :key="ev.id" clickable @click.stop="handleClick(ev)" class="items-start notif-item")
              q-item-section(avatar)
                q-avatar(:size="avatarSize" square)
                  q-img(:src="previewFor(ev)" :ratio="1" no-spinner class="cursor-pointer" @click.stop="openMediaFromEvent(ev)")
              q-item-section(:style="{ minWidth: 0 }")
                .text-body2(:style="{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }")
                  template(v-if="ev.originUsername && hasUserInMessage(ev)")
                    router-link(:to="{ name: 'profile', params: { username: ev.originUsername } }" class="notif-link") @{{ ev.originUsername }}
                    |  {{ actionTextFor(ev) }}
                  template(v-else) {{ messageFor(ev) }}
                .notif-comment-preview.text-caption.q-mt-xs(v-if="commentPreview(ev)")
                  span.notif-comment-link(@click.stop="openCommentFromEvent(ev)") {{ commentPreview(ev) }}
                .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
              q-item-section(side top)
                q-btn(flat round dense :size="isMobile ? 'xs' : 'sm'" :icon="ev.seen ? 'check' : 'mark_email_unread'" :color="ev.seen ? 'grey' : 'primary'" @click.stop="toggleSeen(ev)")
          .text-caption.text-grey-6.q-pa-md.text-center(v-else)
            | No notifications yet
        q-separator
        .q-mt-sm.row.justify-between.items-center
          q-btn(flat dense icon="refresh" label="Refresh" @click.stop="onRefreshClick" :loading="loading")
          q-btn(flat dense icon="list" label="View all" @click.stop="$router.push({ name: 'events' })")

  //- Mobile: full-screen dialog with same layout
  q-dialog(v-if="isMobile" v-model="open" maximized transition-show="fade" transition-hide="fade" @before-show="onBeforeShow")
    q-card.notif-dialog-card.notif-surface
      div.q-pa-sm(:style="menuContainerStyle")
        .q-mb-sm.row.items-center.justify-between
          .text-subtitle2 Notifications
          div.row.items-center.q-gutter-xs
            q-btn(flat dense icon="done_all" @click.stop="markAllSeen" :disable="unreadCount === 0" :loading="loading")
              q-tooltip Mark all as seen
            q-btn(flat dense icon="close" @click.stop="open = false")
              q-tooltip Close
        q-separator
        q-scroll-area(:style="menuScrollStyle")
          q-list(v-if="motdShouldRender" class="motd-container")
            q-item(clickable class="items-start notif-item motd-notif" @click.stop="openMotdFromMenu")
              q-item-section(avatar)
                q-avatar(:size="avatarSize")
                  q-icon(name="campaign" :color="motdUnread ? 'primary' : 'grey-5'")
              q-item-section(:style="{ minWidth: 0 }")
                .text-body2.text-weight-medium(:class="{ 'text-primary': motdUnread }") {{ motdTitle }}
                .text-body2.text-grey-3.q-mt-xs {{ motdSummary }}
                .text-caption.text-grey-6(v-if="motdCreatedAt") {{ timeAgo(motdCreatedAt) }}
          q-list(v-if="recentEvents.length > 0")
            q-item(v-for="ev in recentEvents" :key="ev.id" clickable @click.stop="handleClick(ev)" class="items-start notif-item")
              q-item-section(avatar)
                q-avatar(:size="avatarSize" square)
                  q-img(:src="previewFor(ev)" :ratio="1" no-spinner class="cursor-pointer" @click.stop="openMediaFromEvent(ev)")
              q-item-section(:style="{ minWidth: 0 }")
                .text-body2(:style="{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }")
                  template(v-if="ev.originUsername && hasUserInMessage(ev)")
                    router-link(:to="{ name: 'profile', params: { username: ev.originUsername } }" class="notif-link") @{{ ev.originUsername }}
                    |  {{ actionTextFor(ev) }}
                  template(v-else) {{ messageFor(ev) }}
                .notif-comment-preview.text-caption.q-mt-xs(v-if="commentPreview(ev)")
                  span.notif-comment-link(@click.stop="openCommentFromEvent(ev)") {{ commentPreview(ev) }}
                .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
              q-item-section(side top)
                q-btn(flat round dense :size="isMobile ? 'xs' : 'sm'" :icon="ev.seen ? 'check' : 'mark_email_unread'" :color="ev.seen ? 'grey' : 'primary'" @click.stop="toggleSeen(ev)")
          .text-caption.text-grey-6.q-pa-md.text-center(v-else)
            | No notifications yet
        q-separator
        .q-mt-sm.column.items-stretch.q-gutter-xs
          q-btn(flat dense icon="refresh" label="Refresh" @click.stop="onRefreshClick" :loading="loading" class="full-width")
          q-btn(flat dense icon="list" label="View all" @click.stop="$router.push({ name: 'events' })" class="full-width")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { eventsPrivateEvents, eventsMarkEventSeen, type EventsPrivateEvents200Item, type EventsPrivateEventsParams, EventsPrivateEvents200ItemType as EventsTypeConst } from "../lib/orval"
import { img, s3Video } from "../lib/netlifyImg"
import mediaViwer from "../lib/mediaViewer"
import { emitNotificationsSeen, listenNotificationsSeen } from "../lib/notificationsBus"
import { decodeHtmlEntities } from "../lib/util"
import { viewportHeight } from "src/lib/viewport"
import { useMotdStore } from "stores/motdStore"
import type { MotdMessage } from "stores/motdStore"

export default defineComponent({
  name: "NotificationsMenu",
  data() {
    return {
      open: false as boolean,
      loading: false as boolean,
      events: [] as EventsPrivateEvents200Item[],
      pollId: null as any,
      seenCleanup: null as null | (() => void),
      motd: useMotdStore(),
    }
  },
  computed: {
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return window.matchMedia("(max-width: 1023px)").matches
    },
    unreadCount(): number {
      const eventUnread = this.events.filter((e) => !e.seen).length
      const motdUnread = this.motd?.unreadCount || 0
      return eventUnread + motdUnread
    },
    recentEvents(): EventsPrivateEvents200Item[] {
      return [...this.events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
    },
    menuWidth(): string {
      return this.isMobile ? "100vw" : "420px"
    },
    menuAnchor() {
      return "bottom right" as any
    },
    menuSelf() {
      return "top right"
    },
    menuContentStyle(): Record<string, string> {
      const fullHeight = viewportHeight(100)
      const ninetyHeight = viewportHeight(90)
      return {
        width: this.menuWidth,
        maxWidth: "100vw",
        height: this.isMobile ? fullHeight : "auto",
        maxHeight: this.isMobile ? fullHeight : ninetyHeight,
        overflow: "hidden",
      }
    },
    menuContainerStyle(): Record<string, string> {
      return {
        width: this.isMobile ? "100vw" : "400px",
        height: this.isMobile ? "100%" : "auto",
        minHeight: "0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }
    },
    menuScrollHeight(): string {
      return this.isMobile ? viewportHeight(70) : "360px"
    },
    menuScrollStyle(): Record<string, string> {
      if (this.isMobile) {
        return {
          flex: "1 1 0",
          height: "100%",
          minHeight: "0",
          width: "100%",
          maxWidth: "100%",
          overflow: "auto",
          boxSizing: "border-box",
        }
      } else {
        return {
          height: this.menuScrollHeight,
          width: "100%",
          maxWidth: "100%",
          overflow: "auto",
          boxSizing: "border-box",
        }
      }
    },
    avatarSize(): string {
      return this.isMobile ? "32px" : "48px"
    },
    motdRawMessage(): MotdMessage | null {
      return this.motd?.latest || null
    },
    motdUnread(): boolean {
      return (this.motd?.unreadCount || 0) > 0
    },
    activatorIcon(): string {
      return this.motdUnread ? "campaign" : "notifications"
    },
    activatorColor(): string {
      if (this.motdUnread) return "primary"
      return this.unreadCount > 0 ? "accent" : "grey-4"
    },
    motdShouldRender(): boolean {
      return Boolean(this.motdRawMessage)
    },
    motdTitle(): string {
      return this.motdRawMessage?.title || "Message of the Day"
    },
    motdSummary(): string {
      return this.motdRawMessage?.subheading || "Open to read the latest announcement."
    },
    motdCreatedAt(): string | null {
      return this.motdRawMessage?.startsAt || null
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val: boolean) {
        if (val) {
          void this.refresh()
          this.startPolling()
        } else {
          this.stopPolling()
          this.events = []
        }
      },
    },
  },
  mounted() {
    // Initial refresh/polling handled by the auth watcher (immediate)
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange)
    }
    this.seenCleanup = listenNotificationsSeen(this.onExternalSeen)
  },
  beforeUnmount() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange)
    }
    if (this.seenCleanup) {
      this.seenCleanup()
      this.seenCleanup = null
    }
    this.stopPolling()
  },
  methods: {
    nonErrorTypes(): string[] {
      const ALL = Object.values(EventsTypeConst) as string[]
      return ALL.filter((t) => t !== "asyncError")
    },
    isOwnEvent(ev: EventsPrivateEvents200Item): boolean {
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
    onVisibilityChange() {
      // When the tab becomes visible, re-arm the timer to run immediately
      if (typeof document !== "undefined" && !document.hidden) {
        this.startPolling()
      }
    },
    openMotdFromMenu() {
      if (!this.motdRawMessage) return
      this.open = false
      this.motd.showDialog(true)
    },
    onActivatorClick(evt: Event) {
      if (this.motdUnread) {
        evt.preventDefault()
        evt.stopPropagation()
        this.open = false
        this.motd.showDialog(true)
        return
      }
      if (this.isMobile) {
        evt.stopPropagation()
        this.open = true
        this.onMenuClick(evt)
      }
    },
    onBeforeShow() {
      void this.refresh()
    },
    onMenuClick(evt: Event, go?: any) {
      void this.refresh()
    },
    onRefreshClick(evt: Event, go?: any) {
      void this.refresh()
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
      if (imageId) return img(String(imageId), "sm")
      if (videoId) return s3Video(String(videoId), "thumbnail")
      return "/blankAvatar.webp"
    },
    openMediaFromEvent(ev: EventsPrivateEvents200Item) {
      if (ev.type === "creationCommented" || ev.type === "commentMentioned") {
        void this.openCommentFromEvent(ev)
        return
      }
      const data = this.parseData(ev) || {}
      const imageId = data.imageId || data.image_id
      const videoId = data.videoId || data.video_id
      const media = imageId ? { id: String(imageId), type: "image" } : videoId ? { id: String(videoId), type: "video" } : null
      if (!media) return
      this.open = false
      void this.toggleSeen(ev)
      void mediaViwer.show([media as any], 0)
    },
    startPolling() {
      this.stopPolling()
      const run = async () => {
        try {
          await this.refresh()
        } finally {
          const hidden = typeof document !== "undefined" && document.hidden
          const delay = hidden ? 120000 : 30000
          this.pollId = setTimeout(run, delay)
        }
      }
      this.pollId = setTimeout(run, 1)
    },
    stopPolling() {
      if (this.pollId) {
        clearTimeout(this.pollId)
        this.pollId = null
      }
    },
    async refresh(forceFull = false) {
      if (!this.$userAuth.loggedIn || this.loading) return
      this.loading = true
      try {
        let since: string | undefined
        if (!forceFull && this.events.length > 0) {
          const times = this.events.map((e) => new Date(e.createdAt).getTime())
          const sinceTs = times.length ? Math.max(...times) : 0
          if (sinceTs > 0) since = new Date(sinceTs).toISOString()
        }
        const baseParams: EventsPrivateEventsParams = {
          limit: 25,
          includeSeen: true,
          // Server expects CSV string for types
          types: this.nonErrorTypes().join(","),
        }
        const params = since ? { ...baseParams, since } : baseParams
        const { data } = await eventsPrivateEvents(params)
        let incoming = Array.isArray(data) ? data : []

        if (!forceFull && since && incoming.length === 0) {
          const fullResponse = await eventsPrivateEvents({ ...baseParams })
          incoming = Array.isArray(fullResponse.data) ? fullResponse.data : []
          since = undefined
        }

        // Auto-hide and mark-as-seen self-activity so it never shows or counts
        try {
          const selfUnseen = incoming.filter((e) => this.isOwnEvent(e) && !e.seen)
          if (selfUnseen.length > 0) {
            // Optimistically set seen to avoid any flicker in unread count
            selfUnseen.forEach((e) => (e.seen = true))
            const ids = selfUnseen.map((e) => e.id)
            // Fire-and-forget mark seen calls
            void Promise.all(
              selfUnseen.map((e) =>
                eventsMarkEventSeen({ eventId: e.id }).catch(() => undefined),
              ),
            ).then(() => emitNotificationsSeen(ids))
          }
          // Never show self events in the notifications menu
          incoming = incoming.filter((e) => !this.isOwnEvent(e))
        } catch {
          // ignore
        }

        // Double-ensure asyncError never appears in the menu
        incoming = incoming.filter((e) => e.type !== "asyncError")

        if (since) {
          const byId = new Map<string, EventsPrivateEvents200Item>()
          ;[...incoming, ...this.events].forEach((e) => byId.set(e.id, e))
          this.events = Array.from(byId.values())
        } else {
          this.events = incoming
        }
      } catch (e) {
        // ignore
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
      const hadMotdUnread = this.motdUnread
      if (unseen.length === 0 && !hadMotdUnread) return
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
      if (hadMotdUnread) this.motd.acknowledgeCurrent()
      if (seenIds.length > 0) emitNotificationsSeen(seenIds)
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
      const mediaId = data.mediaId || data.media_id || data.imageId || data.image_id || data.videoId || data.video_id
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
      this.open = false
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

<style lang="sass">
.notif-surface
  /* darker surface for better contrast */
  background-color: rgba(0, 0, 0, 0.75) !important

.notif-link
  /* lighter link color for dark surface */
  color: #9be9ff
  &:hover
    color: #c7f3ff
  &:visited
    color: #9be9ff

.notif-comment-preview
  color: #cfd8dc
  word-break: break-word

.notif-comment-link
  color: #9be9ff
  cursor: pointer
  text-decoration: none
  &:hover
    text-decoration: underline

.notif-item
  align-items: flex-start
  padding-top: 12px
  padding-bottom: 12px
  .q-item__section--avatar
    padding-top: 4px
  .q-item__section--side
    align-self: flex-start
    padding-top: 4px

.notif-menu-mobile
  position: fixed !important
  inset: 0 !important
  width: 100vw !important
  max-width: 100vw !important
  height: 100vh !important
  height: 100dvh !important
  max-height: 100vh !important
  max-height: 100dvh !important
  border-radius: 0 !important
  padding: 0 !important
  transform: none !important
  left: 0 !important
  right: 0 !important
  top: 0 !important
  z-index: 2000
  display: flex !important
  flex-direction: column !important
  overflow: hidden !important

.motd-notif
  background: rgba(130, 233, 222, 0.08)
  border: 1px solid rgba(130, 233, 222, 0.25)
  border-radius: 12px

.motd-container
  position: sticky
  top: 0
  z-index: 2
  padding: 4px 0
  margin: 0
  background: rgba(6, 12, 18, 0.92)

.notif-dialog-card
  width: 100vw
  height: 100vh
  height: 100dvh
  max-width: 100vw
  max-height: 100vh
  max-height: 100dvh
  border-radius: 0
  display: flex
  flex-direction: column
  overflow: hidden
</style>
