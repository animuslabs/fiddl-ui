import { defineStore } from "pinia"
import { creationsBrowseCreateRequests } from "src/lib/orval"
import { img, s3Video } from "lib/netlifyImg"
import { SortMethod } from "fiddl-server/dist/lib/types/serverTypes"
import type { MediaGalleryMeta } from "components/MediaGallery.vue"
import type { MediaType } from "lib/types"

function aspectRatioToNumber(raw?: string | null): number | undefined {
  if (!raw) return undefined
  if (raw.includes(":")) {
    const [w, h] = raw.split(":").map(parseFloat)
    return h && w ? w / h : undefined
  }
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

export const sortMethodIcon: Record<SortMethod, string> = {
  latest: "sym_o_overview",
  popular: "star",
  shuffle: "shuffle",
}

export const mediaTypeIcon: Record<MediaTypeFilter, string> = {
  all: "all_inclusive",
  image: "sym_o_image",
  video: "sym_o_video_library",
}

/** Internal store item */
export interface MediaItem extends MediaGalleryMeta {
  createdAt: Date
}

/** Row returned from creationsBrowseCreateRequests */
interface BrowseRow {
  mediaType: "image" | "video"
  id: string
  createdAt: string // ISO string
  aspectRatio: string
  media: { id: string }[] | null
}
type MediaTypeFilter = MediaType | "all"

export const useBrowserStore = defineStore("browserStore", {
  state: (): {
    media: MediaItem[]
    loading: boolean
    search: string | null
    randomSeed: number
    filter: {
      aspectRatio?: string
      model?: string
      sort: SortMethod
      mediaType: MediaTypeFilter
    }
  } => ({
    media: [],
    loading: false,
    search: null,
    randomSeed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
    filter: { sort: "shuffle", mediaType: "all" },
  }),

  getters: {
    /** legacy alias – other pages still reference items */
    items(state): MediaItem[] {
      return state.media
    },
    newestFirst(state): MediaItem[] {
      return [...state.media].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    filterActive(state): boolean {
      return !!state.filter.aspectRatio || !!state.filter.model
    },
  },

  actions: {
    /* ---------- misc helpers ---------- */
    setSort(method: SortMethod) {
      this.filter.sort = method
      this.reset() // refresh list
    },
    setMediaType(type: MediaTypeFilter) {
      this.filter.mediaType = type
      this.filter.model = undefined
      this.reset()
    },
    resetFilters() {
      this.filter.aspectRatio = undefined
      this.filter.model = undefined
      this.filter.sort = "shuffle"
      this.reset()
    },
    reset() {
      this.media = []
      void this.loadCreations()
    },
    searchCreations() {
      this.media = []
      void this.loadCreations()
    },
    deleteMedia(id: string) {
      this.media = this.media.filter((m) => m.id !== id)
    },

    removeMedia(id: string) {
      this.media = this.media.filter((item) => item.id !== id)
    },

    /* ---------- main loaders ---------- */
    async loadCreations() {
      this.loading = true
      const last = this.media[this.media.length - 1]

      try {
        const { data } = await creationsBrowseCreateRequests({
          order: "desc",
          endDateTime: last?.createdAt.toISOString(),
          limit: 100,
          promptIncludes: this.search || undefined,
          aspectRatio: this.filter.aspectRatio as any,
          model: this.filter.model as any,
          randomSeed: this.filter.sort === "shuffle" ? this.randomSeed : undefined,
          sortMethod: this.filter.sort,
          mediaType: this.filter.mediaType,
        })
        // console.log(data)

        this.addBatch(data as BrowseRow[])
      } catch (err) {
        console.error("loadCreations failed", err)
      } finally {
        this.loading = false
      }
    },

    async loadRecentCreations() {
      if (this.filter.sort !== "latest") return
      this.loading = true
      const first = this.media[0]

      try {
        const { data } = await creationsBrowseCreateRequests({
          order: "asc",
          startDateTime: first?.createdAt.toISOString(),
          limit: 100,
          promptIncludes: this.search || undefined,
          aspectRatio: this.filter.aspectRatio as any,
          model: this.filter.model as any,
          sortMethod: this.filter.sort,
          mediaType: this.filter.mediaType,
        })

        this.addBatch(data as BrowseRow[], true)
      } catch (err) {
        console.error("loadRecentCreations failed", err)
      } finally {
        this.loading = false
      }
    },

    /* ---------- internal util ---------- */
    addBatch(rows: BrowseRow[], prepend = false) {
      for (const row of rows) {
        // Normalize media to a proper array
        let medias: { id: string }[] = []

        if (Array.isArray(row.media)) {
          medias = row.media
        } else if (typeof row.media === "string") {
          try {
            const parsed = JSON.parse(row.media) as unknown
            if (Array.isArray(parsed)) medias = parsed as { id: string }[]
          } catch {
            /* ignore parse errors */
          }
        }

        if (medias.length === 0) continue

        const t = row.mediaType

        for (const m of medias) {
          if (this.media.find((e) => e.id === m.id)) continue

          const item: MediaItem = {
            id: m.id,
            url: t === "image" ? img(m.id, "md") : s3Video(m.id, "preview-md"),
            type: t,
            aspectRatio: aspectRatioToNumber(row.aspectRatio),
            createdAt: new Date(row.createdAt),
          }

          if (prepend) {
            this.media.unshift(item)
          } else {
            this.media.push(item)
          }
        }
      }
    },
  },

  persist: false,
})
