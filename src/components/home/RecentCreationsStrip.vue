<template lang="pug">
.column.full-width
  .row.items-center.justify-between.q-mb-sm
    .text-subtitle1 Recent Creations
    q-btn(flat dense icon="refresh" @click="manualRefresh" :loading="loading")
  q-linear-progress(v-if="loading && items.length === 0" indeterminate color="primary")
  //- Use MediaGallery for a compact mosaic strip
  MediaGallery(
    v-if="items.length > 0"
    :media-objects="galleryItems"
    layout="mosaic"
    :row-height-ratio="1.15"
    :show-loading="false"
    :cols-desktop="8"
    :thumb-size-desktop="90"
    :cols-mobile="5"
    :thumb-size-mobile="60"
    gap="8px"
    show-creator
    :bottom-bar-height="22"
    @select="onSelect"
  )
  .text-caption.text-grey-6(v-else) No recent creations yet
</template>

<script lang="ts">
import { defineComponent } from "vue"
import MediaGallery from "../../components/MediaGallery.vue"
import { creationsBrowseCreateRequests, type CreationsBrowseCreateRequests200Item } from "../../lib/orval"
import { img, s3Video } from "../../lib/netlifyImg"

type MediaStripItem = {
  id: string
  type: "image" | "video"
  url: string
  aspectRatio?: number
  createdAt: string
  nsfw?: boolean
  creatorId?: string
  creatorUsername?: string
}

function parseAspectRatio(raw?: string | null): number | undefined {
  if (!raw) return undefined
  if (raw.includes(":")) {
    const [w, h] = raw.split(":").map((x) => parseFloat(x))
    return h && w ? w / h : undefined
  }
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

export default defineComponent({
  name: "RecentCreationsStrip",
  components: { MediaGallery },
  data() {
    return {
      items: [] as MediaStripItem[],
      loading: false as boolean,
      pollId: null as any,
      limit: 20 as number,
    }
  },
  computed: {
    newestTimestamp(): string | null {
      if (this.items.length === 0) return null
      const max = this.items.reduce((acc, it) => Math.max(acc, new Date(it.createdAt).getTime()), 0)
      return max > 0 ? new Date(max).toISOString() : null
    },
    galleryItems() {
      // Map to MediaGallery expected fields (MediaGalleryMeta)
      return this.items.map((it) => ({
        id: it.id,
        url: it.url,
        type: it.type,
        aspectRatio: it.aspectRatio,
        nsfw: it.nsfw,
        creatorId: it.creatorId,
        creatorUsername: it.creatorUsername,
      }))
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
    onVisibilityChange() {
      // Re-arm when becoming visible
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
        const { data } = await creationsBrowseCreateRequests({
          order: "desc",
          limit: this.limit,
          sortMethod: "latest",
          mediaType: "all",
        })
        this.items = this.normalizeRows(data as unknown as CreationsBrowseCreateRequests200Item[])
      } catch (err) {
         
        console.warn("RecentCreationsStrip refreshFull failed", err)
      } finally {
        this.loading = false
      }
    },
    async refreshDelta() {
      if (this.items.length === 0) return this.refreshFull()
      const since = this.newestTimestamp
      if (!since) return this.refreshFull()
      try {
        // Load ascending to build new head in order
        const { data } = await creationsBrowseCreateRequests({
          order: "asc",
          startDateTime: since,
          limit: 60,
          sortMethod: "latest",
          mediaType: "all",
        })
        const newRows = this.normalizeRows(data as unknown as CreationsBrowseCreateRequests200Item[])
        if (newRows.length > 0) {
          // Append to top in order of creation
          const combined = [...newRows, ...this.items]
          // Dedupe by id while keeping order
          const seen = new Set<string>()
          const unique: MediaStripItem[] = []
          for (const it of combined) {
            if (!seen.has(it.id)) {
              seen.add(it.id)
              unique.push(it)
            }
          }
          this.items = unique.slice(0, this.limit)
        }
      } catch (err) {
         
        console.warn("RecentCreationsStrip refreshDelta failed", err)
      }
    },
    normalizeRows(rows: CreationsBrowseCreateRequests200Item[]): MediaStripItem[] {
      const out: MediaStripItem[] = []
      for (const row of rows) {
        let medias: { id: string; nsfw?: boolean }[] = []
        if (Array.isArray((row as any).media)) {
          medias = (row as any).media as { id: string; nsfw?: boolean }[]
        } else if (typeof (row as any).media === "string") {
          try {
            const parsed = JSON.parse((row as any).media)
            if (Array.isArray(parsed)) medias = parsed as { id: string; nsfw?: boolean }[]
          } catch {}
        }
        if (medias.length === 0) continue
        const t = (row as any).mediaType as "image" | "video"
        for (const m of medias) {
          const id = String(m.id)
          if (out.find((e) => e.id === id)) continue
          out.push({
            id,
            type: t,
            url: t === "image" ? img(id, "sm") : s3Video(id, "preview-md"),
            aspectRatio: parseAspectRatio((row as any).aspectRatio as any),
            createdAt: new Date((row as any).createdAt as any).toISOString(),
            nsfw: m.nsfw === true,
            creatorId: (row as any)?.user?.id,
            creatorUsername: (row as any)?.user?.username,
          })
        }
      }
      // Sort desc by createdAt
      return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, this.limit)
    },
    onSelect(p: { id: string; type: "image" | "video" }) {
      // Forwarded to parent if needed; MediaGallery will handle viewer in parent context if used
    },
    manualRefresh() {
      void this.refreshFull()
    },
  },
})
</script>

