<template lang="pug">
.column.full-width
  .row.items-center.justify-between.q-mb-sm
    .text-subtitle1 Unlocks & Upvotes
    q-btn(flat dense icon="refresh" @click="manualRefresh" :loading="loading")
  q-linear-progress(v-if="loading && events.length === 0" indeterminate color="primary")
  q-list(v-if="events.length > 0")
    q-item(v-for="ev in events" :key="ev.id" clickable @click="openMedia(ev)")
      q-item-section(avatar)
        q-avatar(size="40px" square)
          q-img(:src="previewUrlForEvent(ev)" :ratio="1" no-spinner)
      q-item-section
        .row.items-start.justify-between(:style="{ gap: '8px' }")
          .column(:style="{ flex: '1 1 0', minWidth: 0 }")
            .text-body2(:style="{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }") {{ actionTextForPublic(ev) }}
          .text-caption.text-grey-6 {{ timeAgo(ev.createdAt) }}
  .text-caption.text-grey-6(v-else) No activity yet
</template>

<script lang="ts">
import { defineComponent } from "vue"
import mediaViwer from "../../lib/mediaViewer"
import {
  eventsPublicEvents,
  type EventsPublicEvents200Item,
  type EventsPublicEventsParams,
} from "../../lib/orval"
import {
  actionTextForPublic,
  previewUrlForEvent,
  getMediaFromEvent,
  timeAgo,
  UNLOCK_LIKE_TYPES,
} from "../../lib/publicEvents"

export default defineComponent({
  name: "UnlockUpvoteFeed",
  data() {
    return {
      loading: false as boolean,
      events: [] as EventsPublicEvents200Item[],
      pollId: null as any,
      limit: 200 as number,
    }
  },
  computed: {
    newestTimestamp(): string | null {
      if (this.events.length === 0) return null
      const max = this.events.reduce((acc, e) => Math.max(acc, new Date(e.createdAt).getTime()), 0)
      return max > 0 ? new Date(max).toISOString() : null
    },
  },
  mounted() {
    void this.refreshFull()
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange)
    }
    this.armPoll()
  },
  beforeUnmount() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange)
    }
    this.clearPoll()
  },
  methods: {
    actionTextForPublic,
    previewUrlForEvent,
    timeAgo,
    onVisibilityChange() {
      this.armPoll()
    },
    armPoll() {
      this.clearPoll()
      const run = async () => {
        try {
          if (typeof document === "undefined" || !document.hidden) {
            await this.refreshDelta()
          }
        } finally {
          this.pollId = setTimeout(run, 15000)
        }
      }
      this.pollId = setTimeout(run, 15000)
    },
    clearPoll() {
      if (this.pollId) {
        clearTimeout(this.pollId)
        this.pollId = null
      }
    },
    async refreshFull() {
      this.loading = true
      try {
        const baseParams: EventsPublicEventsParams = {
          limit: this.limit,
          // Server expects CSV string if provided as single param
          types: UNLOCK_LIKE_TYPES.join(","),
        }
        const { data } = await eventsPublicEvents(baseParams)
        const list = Array.isArray(data) ? data : []
        this.events = this.normalize(list)
      } catch (err) {
         
        console.warn("UnlockUpvoteFeed refreshFull failed", err)
      } finally {
        this.loading = false
      }
    },
    async refreshDelta() {
      if (this.events.length === 0) return this.refreshFull()
      const since = this.newestTimestamp
      if (!since) return this.refreshFull()
      try {
        const { data } = await eventsPublicEvents({
          limit: this.limit,
          since,
          types: UNLOCK_LIKE_TYPES.join(","),
        })
        const incoming = Array.isArray(data) ? data : []
        if (incoming.length > 0) {
          const merged = this.mergeDedup([...incoming, ...this.events])
          this.events = this.normalize(merged).slice(0, this.limit)
        }
      } catch (err) {
         
        console.warn("UnlockUpvoteFeed refreshDelta failed", err)
      }
    },
    mergeDedup(list: EventsPublicEvents200Item[]): EventsPublicEvents200Item[] {
      const byId = new Map<string, EventsPublicEvents200Item>()
      for (const ev of list) byId.set(ev.id, ev)
      return Array.from(byId.values())
    },
    normalize(list: EventsPublicEvents200Item[]): EventsPublicEvents200Item[] {
      // Ensure order desc by createdAt, and filter to desired types just in case
      return list
        .filter((e) => UNLOCK_LIKE_TYPES.includes(e.type))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },
    openMedia(ev: EventsPublicEvents200Item) {
      const m = getMediaFromEvent(ev)
      if (!m) return
      void mediaViwer.show([m as any], 0)
    },
    manualRefresh() {
      void this.refreshFull()
    },
  },
})
</script>

