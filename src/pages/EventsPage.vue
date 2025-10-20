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
    q-card.motd-history-card.q-mb-lg(flat bordered)
      q-card-section
        .row.items-center.justify-between
          .row.items-center.q-gutter-sm
            q-icon(name="campaign" color="primary")
            .column
              .text-subtitle1.text-weight-medium Messages of the Day
              .text-caption.text-grey-6 Review current and past announcements.
          q-btn(flat dense icon="refresh" label="Refresh" @click="refreshMotds" :loading="motdLoading")
      q-separator
      q-card-section(v-if="motdError")
        .text-negative.text-body2 {{ motdError }}
      q-linear-progress(v-else-if="motdLoading" indeterminate color="primary")
      q-list(v-else-if="hasMotdEntries")
        q-item(
          v-for="entry in motdHistory"
          :key="entry.id"
          clickable
          @click="openMotd(entry)"
          :class="isMotdUnread(entry) ? 'bg-grey-10' : ''"
        )
          q-item-section(avatar)
            q-avatar(:color="isMotdUnread(entry) ? 'accent' : 'primary'" text-color="white" icon="campaign")
          q-item-section
            .column.q-gutter-xs(:style="{ minWidth: 0 }")
              .text-body1.text-weight-medium {{ motdTitle(entry) }}
              .text-caption.text-grey-5 {{ motdListDate(entry) }}
              .text-caption.text-grey-6.motd-subheading(v-if="motdSubheading(entry)") {{ motdSubheading(entry) }}
          q-item-section(side top)
            .column.items-end.q-gutter-xs
              q-badge(:color="motdStatusColor(entry)" text-color="white" :label="motdStatusLabel(entry)")
              q-badge(v-if="entry.id === currentMotdId" color="primary" text-color="white" label="Current")
      q-card-section(v-else class="text-grey-6")
        | No messages available yet.

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

  q-dialog(
    v-model="motdDialogVisible"
    transition-show="scale"
    transition-hide="scale"
    :maximized="$q.screen.lt.md"
    @hide="closeMotdDialog"
  )
    q-card(:class="[$q.screen.lt.md ? 'motd-dialog-card motd-dialog-card--xs' : 'motd-dialog-card']" flat bordered)
      q-card-section
        .row.items-start.no-wrap.q-col-gutter-md
          q-icon(name="campaign" size="36px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs(style="min-width:0")
            .text-h6.text-weight-bold {{ motdDialogTitle }}
            .text-caption.text-grey-5.text-uppercase(v-if="motdDialogDate") {{ motdDialogDate }}
            .text-caption.text-grey-6(v-if="motdDialogExpires") Expires: {{ motdDialogExpires }}
            .text-body2.text-grey-4(v-if="motdDialogSubheading") {{ motdDialogSubheading }}
      q-separator
      q-card-section(:class="[$q.screen.lt.md ? 'motd-body motd-body--xs' : 'motd-body']")
        template(v-if="motdDialogLoading")
          .row.justify-center.q-my-lg
            q-spinner(color="primary" size="32px")
        template(v-else-if="motdDialogError")
          .text-negative.text-body2 {{ motdDialogError }}
        template(v-else-if="motdDialogMessage")
          div.motd-markdown(v-html="motdDialogBodyHtml")
        template(v-else)
          .text-grey-6 No message selected.
      q-separator
      q-card-actions(align="right" class="motd-card-actions")
        q-btn(flat icon="close" color="primary" label="Close" @click="closeMotdDialog")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import {
  eventsPrivateEvents,
  eventsMarkEventSeen,
  motdAvailable,
  motdGet,
  motdMarkRead,
  EventsPrivateEvents200ItemType as EventsTypeConst,
  type EventsPrivateEvents200Item,
  type EventsPrivateEventsParams,
  type EventsPrivateEvents200ItemType,
  type MotdAvailable200Item,
  type MotdGet200,
} from "../lib/orval"
import { img, s3Video } from "../lib/netlifyImg"
import mediaViwer from "../lib/mediaViewer"
import { emitNotificationsSeen, listenNotificationsSeen } from "../lib/notificationsBus"
import { decodeHtmlEntities } from "../lib/util"
import { renderMarkdown } from "../lib/markdown"
import { useMotdStore, type MotdMessage } from "stores/motdStore"

const ALL_TYPES = Object.values(EventsTypeConst) as EventsPrivateEvents200ItemType[]

export default defineComponent({
  name: "EventsPage",
  setup() {
    const motdStore = useMotdStore()
    return { motdStore }
  },
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
      motdLoading: false as boolean,
      motdEntries: [] as MotdAvailable200Item[],
      motdError: null as string | null,
      motdDialogVisible: false as boolean,
      motdDialogLoading: false as boolean,
      motdDialogMessage: null as MotdMessage | null,
      motdDialogError: null as string | null,
      motdDetailsCache: {} as Record<string, MotdMessage>,
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
    motdHistory(): MotdAvailable200Item[] {
      if (!Array.isArray(this.motdEntries)) return []
      return [...this.motdEntries].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    },
    hasMotdEntries(): boolean {
      return this.motdHistory.length > 0
    },
    currentMotdId(): string | null {
      return this.motdStore?.latest?.id ?? null
    },
    motdDialogTitle(): string {
      return this.motdDialogMessage?.title || "Message of the Day"
    },
    motdDialogSubheading(): string | null {
      return this.motdDialogMessage?.subheading ?? null
    },
    motdDialogDate(): string {
      const iso = this.motdDialogMessage?.startsAt
      if (!iso) return ""
      return this.formatMotdDate(iso, { year: "numeric", month: "short", day: "numeric" })
    },
    motdDialogExpires(): string {
      const iso = this.motdDialogMessage?.expiresAt
      if (!iso) return ""
      return this.formatMotdDate(iso, { year: "numeric", month: "short", day: "numeric" })
    },
    motdDialogBodyHtml(): string {
      return renderMarkdown(this.motdDialogMessage?.body || "")
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val: boolean) {
        if (val) {
          void this.refresh()
          void this.refreshMotds()
        } else {
          this.events = []
          this.motdEntries = []
          this.motdDialogVisible = false
          this.motdDialogMessage = null
          this.motdError = null
          this.motdDialogError = null
        }
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
    currentMotdId(newVal: string | null, oldVal: string | null) {
      if (
        newVal &&
        newVal !== oldVal &&
        this.$userAuth.loggedIn &&
        !this.motdEntries.some((item) => item.id === newVal)
      ) {
        void this.refreshMotds()
      }
    },
    "motdStore.latest": {
      deep: false,
      handler(val: MotdMessage | null) {
        if (!val) return
        this.motdDetailsCache = { ...this.motdDetailsCache, [val.id]: { ...val } }
        const latestMeta: MotdAvailable200Item = {
          id: val.id,
          startsAt: val.startsAt,
          updatedAt: val.updatedAt,
          expiresAt: val.expiresAt ?? null,
          readAt: val.readAt ?? null,
          unread: !val.readAt,
        }
        const idx = this.motdEntries.findIndex((item) => item.id === val.id)
        if (idx >= 0) {
          const updated = [...this.motdEntries]
          updated.splice(idx, 1, latestMeta)
          this.motdEntries = updated
        } else {
          this.motdEntries = [latestMeta, ...this.motdEntries]
        }
      },
    },
    // Keep page in range when filters change
    sorted() {
      if (this.page > this.pageCount) this.page = this.pageCount
    },
  },
  mounted() {
    if (this.$userAuth.loggedIn) {
      void this.refresh()
      void this.refreshMotds()
    }
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
    async prefetchMotdDetails(entries: MotdAvailable200Item[]) {
      if (!Array.isArray(entries) || entries.length === 0) return
      const sorted = [...entries].sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      )
      const recent = sorted.slice(0, 5)
      const tasks = recent.map(async (entry) => {
        if (!entry?.id) return
        if (this.motdDetailsCache?.[entry.id]) return
        const latest = this.motdStore?.latest
        if (latest && latest.id === entry.id) {
          this.motdDetailsCache = { ...this.motdDetailsCache, [latest.id]: { ...latest } }
          this.updateMotdEntryRead(entry.id, latest.readAt ?? null, !latest.readAt)
          return
        }
        try {
          const { data } = await motdGet({ id: entry.id })
          const mapped = this.mapMotdDetail(data, entry)
          this.motdDetailsCache = { ...this.motdDetailsCache, [mapped.id]: { ...mapped } }
          const unreadFlag = typeof data.unread === "boolean" ? data.unread : !mapped.readAt
          this.updateMotdEntryRead(entry.id, mapped.readAt ?? null, unreadFlag)
        } catch {
          // silent; details can still be loaded on demand
        }
      })
      await Promise.allSettled(tasks)
    },
    async refreshMotds() {
      if (!this.$userAuth.loggedIn || this.motdLoading) return
      this.motdLoading = true
      this.motdError = null
      try {
        const { data } = await motdAvailable({ includeRead: true })
        const list = Array.isArray(data) ? data : []
        this.motdEntries = [...list]
        const keepIds = new Set(list.map((item) => item.id))
        const nextCache: Record<string, MotdMessage> = {}
        for (const id of keepIds) {
          const cached = this.motdDetailsCache[id]
          if (cached) nextCache[id] = { ...cached }
        }
        const latest = this.motdStore?.latest
        if (latest && keepIds.has(latest.id)) {
          nextCache[latest.id] = { ...latest }
        }
        this.motdDetailsCache = nextCache
        void this.prefetchMotdDetails(list)
      } catch (err) {
        this.motdError = err instanceof Error ? err.message : "Failed to load MOTDs"
      } finally {
        this.motdLoading = false
      }
    },
    async openMotd(entry: MotdAvailable200Item) {
      this.motdDialogError = null
      this.motdDialogMessage = null
      this.motdDialogVisible = true
      this.motdDialogLoading = true
      try {
        const message = await this.loadMotdDetail(entry)
        this.motdDialogMessage = message
        await this.ensureMotdMarkedRead(entry, message)
      } catch (err) {
        this.motdDialogError = err instanceof Error ? err.message : "Failed to load message"
      } finally {
        this.motdDialogLoading = false
      }
    },
    closeMotdDialog() {
      this.motdDialogVisible = false
    },
    async loadMotdDetail(entry: MotdAvailable200Item): Promise<MotdMessage> {
      const cached = this.motdDetailsCache?.[entry.id]
      if (cached) return { ...cached }
      const latest = this.motdStore?.latest
      if (latest && latest.id === entry.id) {
        const clone = { ...latest }
        this.motdDetailsCache = { ...this.motdDetailsCache, [clone.id]: clone }
        return clone
      }
      const { data } = await motdGet({ id: entry.id })
      const mapped = this.mapMotdDetail(data, entry)
      this.motdDetailsCache = { ...this.motdDetailsCache, [mapped.id]: { ...mapped } }
      return mapped
    },
    mapMotdDetail(detail: MotdGet200, meta?: MotdAvailable200Item | null): MotdMessage {
      return {
        id: detail.id,
        title: detail.title,
        subheading: detail.subheading ?? null,
        body: detail.body,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
        startsAt: detail.startsAt,
        expiresAt: detail.expiresAt ?? null,
        readAt: detail.readAt ?? meta?.readAt ?? null,
      }
    },
    async ensureMotdMarkedRead(entry: MotdAvailable200Item, message: MotdMessage) {
      if (!this.isMotdUnread(entry) && message.readAt) {
        this.updateMotdEntryRead(entry.id, message.readAt)
        return
      }
      try {
        if (this.motdStore?.latest?.id === entry.id) {
          await this.motdStore.markCurrentAsRead()
          const readAt = this.motdStore.latest?.readAt ?? new Date().toISOString()
          message.readAt = readAt
          this.updateMotdEntryRead(entry.id, readAt)
        } else {
          const { data } = await motdMarkRead({ id: entry.id })
          const readAt = data?.readAt ?? new Date().toISOString()
          message.readAt = readAt
          this.updateMotdEntryRead(entry.id, readAt)
        }
      } catch {
        const fallback = new Date().toISOString()
        message.readAt = fallback
        this.updateMotdEntryRead(entry.id, fallback)
      }
    },
    updateMotdEntryRead(id: string, readAt?: string | null, unreadOverride?: boolean) {
      this.motdEntries = this.motdEntries.map((item) =>
        item.id === id
          ? {
              ...item,
              readAt: readAt ?? item.readAt ?? null,
              unread: typeof unreadOverride === "boolean" ? unreadOverride : false,
            }
          : item,
      )
      if (this.motdDetailsCache[id]) {
        const cached = this.motdDetailsCache[id]
        this.motdDetailsCache = {
          ...this.motdDetailsCache,
          [id]: { ...cached, readAt: readAt ?? cached.readAt ?? null },
        }
      }
    },
    isMotdUnread(entry: MotdAvailable200Item): boolean {
      return Boolean(entry.unread || !entry.readAt)
    },
    motdStatusLabel(entry: MotdAvailable200Item): string {
      return this.isMotdUnread(entry) ? "Unread" : "Read"
    },
    motdStatusColor(entry: MotdAvailable200Item): string {
      return this.isMotdUnread(entry) ? "accent" : "grey-7"
    },
    formatMotdDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
      if (!iso) return ""
      try {
        return new Date(iso).toLocaleString(undefined, options)
      } catch {
        return iso
      }
    },
    motdListDate(entry: MotdAvailable200Item): string {
      return this.formatMotdDate(entry.startsAt, { year: "numeric", month: "short", day: "numeric" })
    },
    motdTitle(entry: MotdAvailable200Item): string {
      const cached = this.motdDetailsCache?.[entry.id]
      if (cached?.title) return cached.title
      const latest = this.motdStore?.latest
      if (latest && latest.id === entry.id) return latest.title
      return `Message from ${this.motdListDate(entry)}`
    },
    motdSubheading(entry: MotdAvailable200Item): string {
      const cached = this.motdDetailsCache?.[entry.id]
      if (cached?.subheading) return cached.subheading
      const latest = this.motdStore?.latest
      if (latest && latest.id === entry.id) return latest.subheading ?? ""
      return ""
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

<style lang="sass" scoped>
.motd-history-card
  background: rgba(255, 255, 255, 0.02)
  border: 1px solid rgba(255, 255, 255, 0.06)

.motd-subheading
  white-space: normal
  word-break: break-word
  overflow-wrap: anywhere

.motd-dialog-card
  width: min(720px, 92vw)
  display: flex
  flex-direction: column

.motd-dialog-card--xs
  width: 100%
  height: 100%
  max-width: 100%
  max-height: 100%
  border-radius: 0
  flex: 1

.motd-body
  max-height: 55vh
  overflow: auto

.motd-body--xs
  flex: 1
  max-height: none
  overflow: auto

.motd-markdown
  color: #eceff1
  font-size: 16px
  line-height: 1.5
  word-break: break-word
  a
    color: #82e9de
    text-decoration: none
    &:hover
      text-decoration: underline
  img
    display: block
    width: 100%
    height: auto
    max-width: 100%
    max-height: 50vh
    object-fit: contain
    border-radius: 6px
    margin: 12px auto
  h1
    font-size: 22px
    line-height: 1.3
  h2
    font-size: 19px
    line-height: 1.3
  h3
    font-size: 18px
    line-height: 1.3
  h4, h5, h6
    font-size: 17px
    line-height: 1.3
  h1, h2, h3, h4, h5, h6
    margin-top: 20px
    margin-bottom: 10px
  pre
    background: rgba(255, 255, 255, 0.05)
    padding: 12px
    border-radius: 6px
    overflow: auto
    font-family: var(--q-code-font-family)
  code
    background: rgba(255, 255, 255, 0.08)
    padding: 2px 4px
    border-radius: 4px

.motd-card-actions
  margin-top: auto
</style>
