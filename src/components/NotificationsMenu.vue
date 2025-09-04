<template lang="pug">
div.relative-position.self-center
  q-btn(
    round
    flat
    dense
    padding="1px"
    size="md"
    :color="unreadCount > 0 ? 'accent' : 'grey-4'"
    icon="notifications"
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
    ).bg-blur
      div.q-pa-sm(:style="menuContainerStyle")
        .q-mb-sm.row.items-center.justify-between
          .text-subtitle2 Notifications
          q-btn(flat dense icon="done_all" @click.stop="markAllSeen" :disable="unreadCount === 0" :loading="loading")
            q-tooltip Mark all as seen
        q-separator
        q-scroll-area(:style="menuScrollStyle")
          q-list(v-if="recentEvents.length > 0" :dense="isMobile")
            q-item(v-for="ev in recentEvents" :key="ev.id" clickable :dense="isMobile" @click.stop="handleClick(ev)")
              q-item-section(avatar)
                q-avatar(:size="isMobile ? '24px' : '48px'" square)
                  q-img(:src="previewFor(ev)" :ratio="1" no-spinner class="cursor-pointer" @click.stop="openMediaFromEvent(ev)")
              q-item-section(:style="{ minWidth: 0 }")
                .text-body2(:style="isMobile ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}") {{ messageFor(ev) }}
                .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
              q-item-section(side)
                q-btn(flat round dense :size="isMobile ? 'xs' : 'sm'" :icon="ev.seen ? 'check' : 'mark_email_unread'" :color="ev.seen ? 'grey' : 'primary'" @click.stop="toggleSeen(ev)")
          .text-caption.text-grey-6.q-pa-md.text-center(v-else)
            | No notifications yet
        q-separator
        .q-mt-sm.row.justify-between.items-center
          q-btn(flat dense icon="refresh" label="Refresh" @click.stop="onRefreshClick" :loading="loading")
          q-btn(flat dense icon="list" label="View all" @click.stop="$router.push({ name: 'events' })")

  //- Mobile: full-screen dialog with same layout
  q-dialog(v-if="isMobile" v-model="open" maximized transition-show="fade" transition-hide="fade" @before-show="onBeforeShow")
    q-card.notif-dialog-card.bg-blur
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
          q-list(v-if="recentEvents.length > 0" :dense="isMobile")
            q-item(v-for="ev in recentEvents" :key="ev.id" clickable :dense="isMobile" @click.stop="handleClick(ev)")
              q-item-section(avatar)
                q-avatar(:size="isMobile ? '24px' : '28px'" square)
                  q-img(:src="previewFor(ev)" :ratio="1" no-spinner class="cursor-pointer" @click.stop="openMediaFromEvent(ev)")
              q-item-section(:style="{ minWidth: 0 }")
                .text-body2(:style="isMobile ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}") {{ messageFor(ev) }}
                .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
              q-item-section(side)
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
import { eventsPrivateEvents, eventsMarkEventSeen, type EventsPrivateEvents200Item, type EventsPrivateEventsParams } from "../lib/orval"
import { img, s3Video } from "../lib/netlifyImg"
import mediaViwer from "../lib/mediaViewer"

export default defineComponent({
  name: "NotificationsMenu",
  data() {
    return {
      open: false as boolean,
      loading: false as boolean,
      events: [] as EventsPrivateEvents200Item[],
      pollId: null as any,
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
      return {
        width: this.menuWidth,
        maxWidth: "100vw",
        height: this.isMobile ? "100dvh" : "auto",
        maxHeight: this.isMobile ? "100dvh" : "90vh",
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
      return this.isMobile ? "70vh" : "360px"
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
    if (this.$userAuth.loggedIn) {
      void this.refresh()
      this.startPolling()
    }
  },
  beforeUnmount() {
    this.stopPolling()
  },
  methods: {
    onActivatorClick(evt: Event) {
      if (this.isMobile) {
        // Only programmatically open on mobile
        evt.stopPropagation()
        this.open = true
        this.onMenuClick(evt)
      }
      // On desktop, let QMenu handle toggle via parent click
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
      const imageId = data.imageId || data.image_id
      const videoId = data.videoId || data.video_id
      if (imageId) return img(String(imageId), "sm")
      if (videoId) return s3Video(String(videoId), "thumbnail")
      return "/blankAvatar.webp"
    },
    openMediaFromEvent(ev: EventsPrivateEvents200Item) {
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
      this.pollId = setInterval(() => {
        void this.refresh()
      }, 30000)
    },
    stopPolling() {
      if (this.pollId) {
        clearInterval(this.pollId)
        this.pollId = null
      }
    },
    async refresh(forceFull = false) {
      if (!this.$userAuth.loggedIn) return
      if (this.loading) return
      this.loading = true
      try {
        let since: string | undefined
        if (!forceFull && this.events.length > 0) {
          const times = this.events.map((e) => new Date(e.createdAt).getTime())
          const sinceTs = times.length ? Math.max(...times) : 0
          if (sinceTs > 0) since = new Date(sinceTs).toISOString()
        }
        const params: EventsPrivateEventsParams = since ? { since, limit: 25, includeSeen: true } : { limit: 25, includeSeen: true }
        const { data } = await eventsPrivateEvents(params)
        const incoming = Array.isArray(data) ? data : []
        if (since) {
          if (incoming.length === 0) return
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
      } catch (e) {
        // ignore
      }
    },
    async markAllSeen() {
      const unseen = this.events.filter((e) => !e.seen)
      await Promise.all(
        unseen.map((e) =>
          eventsMarkEventSeen({ eventId: e.id })
            .then(() => (e.seen = true))
            .catch(() => {}),
        ),
      )
    },
    handleClick(ev: EventsPrivateEvents200Item) {
      void this.toggleSeen(ev)
    },
    iconFor(type: string) {
      if (type.includes("Video")) return "smart_display"
      if (type.includes("Image")) return "image"
      return "notifications"
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
        default:
          return `Activity: ${ev.type}`
      }
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
.notif-menu-mobile
  position: fixed !important
  inset: 0 !important
  width: 100vw !important
  max-width: 100vw !important
  height: 100dvh !important
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

.notif-dialog-card
  width: 100vw
  height: 100dvh
  max-width: 100vw
  max-height: 100dvh
  border-radius: 0
  display: flex
  flex-direction: column
  overflow: hidden
</style>
