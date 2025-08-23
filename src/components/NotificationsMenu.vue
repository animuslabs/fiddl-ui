<template lang="pug">
div.relative-position.self-center
  q-btn(
    round
    flat
    dense
    padding="1px"
    size="xs"
    :color="unreadCount > 0 ? 'accent' : 'grey-4'"
    icon="notifications"
  )
    q-badge(v-if="unreadCount > 0" floating color="red" :label="unreadCount > 99 ? '99+' : String(unreadCount)")
    q-menu(
      v-model="open"
      :anchor="menuAnchor"
      :self="menuSelf"
      :content-style="menuContentStyle"
      @before-show="refresh"
    )
      div.q-pa-sm
        .row.items-center.justify-between.q-mb-sm
          .text-subtitle2 Notifications
          q-btn(flat dense icon="done_all" @click.stop="markAllSeen" :disable="unreadCount === 0" :loading="loading")
            q-tooltip Mark all as seen
        q-separator
        q-scroll-area(:style="{ height: menuScrollHeight }")
          q-list
            q-item(v-for="ev in recentEvents" :key="ev.id" clickable @click.stop="handleClick(ev)")
              q-item-section(avatar)
                q-avatar(:size="isMobile ? '24px' : '28px'" square)
                  q-img(:src="previewFor(ev)" :ratio="1" no-spinner)
              q-item-section
                .text-body2 {{ messageFor(ev) }}
                .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
              q-item-section(side)
                q-btn(flat round dense size="sm" :icon="ev.seen ? 'check' : 'mark_email_unread'" :color="ev.seen ? 'grey' : 'primary'" @click.stop="toggleSeen(ev)")
        q-separator
        .row.justify-between.items-center.q-mt-sm
          q-btn(flat dense icon="refresh" label="Refresh" @click.stop="refresh" :loading="loading")
          q-btn(flat dense icon="list" label="View all" @click.stop="$router.push({ name: 'events' })")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { eventsPrivateEvents, eventsMarkEventSeen, type EventsPrivateEvents200Item, type EventsPrivateEventsParams } from "../lib/orval"
import { img, s3Video } from "../lib/netlifyImg"

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
      return { width: "400px", maxWidth: this.menuWidth, maxHeight: "90vh" }
    },
    menuContainerStyle(): Record<string, string> {
      return {
        width: "100%",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }
    },
    menuScrollHeight(): string {
      return this.isMobile ? "60vh" : "360px"
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
      if (imageId) return img(String(imageId), "md")
      if (videoId) return s3Video(String(videoId), "thumbnail")
      return "/blankAvatar.webp"
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
    async refresh() {
      if (!this.$userAuth.loggedIn) return
      this.loading = true
      try {
        const params: EventsPrivateEventsParams = { limit: 25, includeSeen: true }
        const { data } = await eventsPrivateEvents(params)
        this.events = data
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
