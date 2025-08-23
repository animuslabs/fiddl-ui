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
      q-select(
        v-model="selectedTypes"
        label="Types"
        :options="typeOptions"
        multiple
        use-chips
        dense
        options-dense
        clearable
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
          .row.items-center.justify-between
            .text-body2 {{ messageFor(ev) }}
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
import { eventsPrivateEvents, eventsMarkEventSeen, type EventsPrivateEvents200Item, type EventsPrivateEventsParams } from "../lib/orval"
import { img, s3Video } from "../lib/netlifyImg"

const ALL_TYPES = [
  "likedImage",
  "likedVideo",
  "unlikedVideo",
  "addedImageToCollection",
  "unlockedImage",
  "unlockedVideo",
  "unlikedImage",
  "removedImageFromCollection",
  "referredUser",
] as const

export default defineComponent({
  name: "EventsPage",
  data() {
    return {
      loading: false as boolean,
      events: [] as EventsPrivateEvents200Item[],
      page: 1 as number,
      pageSize: 20 as number,
      showUnseenOnly: false as boolean,
      selectedTypes: [] as string[],
      typeOptions: ALL_TYPES.map((t) => ({ label: t, value: t })),
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
      if (this.showUnseenOnly) arr = arr.filter((e) => !e.seen)
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
    // Keep page in range when filters change
    sorted() {
      if (this.page > this.pageCount) this.page = this.pageCount
    },
  },
  mounted() {
    if (this.$userAuth.loggedIn) void this.refresh()
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
    async refresh() {
      if (!this.$userAuth.loggedIn) return
      this.loading = true
      try {
        // Pull a generous page and paginate client-side
        const params: EventsPrivateEventsParams = { limit: 200, includeSeen: true }
        const { data } = await eventsPrivateEvents(params)
        this.events = data
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
      } catch (e) {
        // ignore
      }
    },
    async markAllSeen() {
      const unseen = this.events.filter((e) => !e.seen)
      if (unseen.length === 0) return
      this.loading = true
      try {
        await Promise.all(
          unseen.map((e) =>
            eventsMarkEventSeen({ eventId: e.id })
              .then(() => (e.seen = true))
              .catch(() => {}),
          ),
        )
      } finally {
        this.loading = false
      }
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