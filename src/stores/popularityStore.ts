import { defineStore } from "pinia"
import { openDB, IDBPDatabase } from "idb"
import { Dialog } from "quasar"
import LikeMedia from "src/components/dialogs/LikeMedia.vue"
import { popularityBatch, type PopularityBatchBody, type PopularityBatch200Item, collectionsLikeMedia, collectionsUnlikeMedia, upvotesUpvote, upvotesDownvote, upvotesUnhide } from "lib/orval"
import { useUserAuth } from "stores/userAuth"

export interface PopularityEntry {
  id: string
  mediaType?: "image" | "video"
  favorites: number
  upvotes: number
  downvotes: number
  isFavoritedByMe?: boolean
  isUpvotedByMe?: boolean
  hidden?: boolean
  updatedAt?: number
}

interface PopularityState {
  entries: Record<string, PopularityEntry>
  _db: IDBPDatabase | null
  _loaded: boolean
  _inFlight: Record<string, boolean>
  _mutating: Record<string, boolean>
}

const DB_NAME = "PopularityDB"
const STORE_NAME = "PopularityStore"
const CHUNK_SIZE = 100

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    },
  })
}

export const usePopularityStore = defineStore("popularityStore", {
  state: (): PopularityState => ({
    entries: {},
    _db: null,
    _loaded: false,
    _inFlight: {},
    _mutating: {},
  }),
  getters: {
    get:
      (state) =>
      (id: string): PopularityEntry | undefined =>
        state.entries[id],
  },
  actions: {
    async init() {
      if (this._db) return
      this._db = await getDB()
      if (!this._loaded) {
        // Mark as initialized and load entire cache in background to avoid blocking UI
        this._loaded = true
        void this._loadAllFromDB()
      }
    },
    async _loadAllFromDB() {
      if (!this._db) return
      const tx = this._db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      let cursor = await store.openCursor()
      while (cursor) {
        const entry = cursor.value as PopularityEntry
        this.entries[entry.id] = entry
        cursor = await cursor.continue()
      }
      await tx.done
    },
    async _loadFromDBByIds(ids: string[]) {
      await this.init()
      if (!this._db || !ids?.length) return
      const unique = Array.from(new Set(ids.filter(Boolean)))
      const tx = this._db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      for (const id of unique) {
        try {
          const val = (await store.get(id)) as PopularityEntry | undefined
          if (val) {
            this.entries[id] = val
          }
        } catch (e) {
          console.error("[popularityStore] _loadFromDBByIds failed", id, e)
        }
      }
      await tx.done
    },
    async _put(entry: PopularityEntry) {
      await this.init()
      if (!this._db) return
      const toSave = { ...entry, updatedAt: Date.now() }
      await this._db.put(STORE_NAME, toSave)
      this.entries[entry.id] = { ...toSave }
    },
    async _putMany(entries: PopularityEntry[]) {
      await this.init()
      if (!this._db) return
      const tx = this._db.transaction(STORE_NAME, "readwrite")
      for (const e of entries) {
        const toSave = { ...e, updatedAt: Date.now() }
        await tx.store.put(toSave)
        this.entries[e.id] = { ...toSave }
      }
      await tx.done
    },
    async fetchBatch(ids: string[]) {
      // Back-compat: assume images when mediaType is unknown
      const items = Array.from(new Set(ids.filter(Boolean))).map((id) => ({ id, mediaType: "image" as const }))
      await this.fetchBatchByItems(items)
    },
    async fetchBatchByItems(items: { id: string; mediaType: "image" | "video" }[], upvotesSinceDays?: number) {
      await this.init()
      // Collapse to unique ids first
      const uniqueById = new Map<string, { id: string; mediaType: "image" | "video" }>()
      for (const it of items) {
        if (!uniqueById.has(it.id)) uniqueById.set(it.id, it)
      }

      // Fast path: hydrate cache for just these ids from IndexedDB (non-blocking for others)
      await this._loadFromDBByIds(Array.from(uniqueById.keys()))

      // Determine which IDs actually need fetching (not cached and not already in flight)
      const toRequest = Array.from(uniqueById.values()).filter((it) => !this.entries[it.id] && !this._inFlight[it.id])
      if (toRequest.length === 0) return

      // mark in-flight to dedupe concurrent calls
      for (const it of toRequest) this._inFlight[it.id] = true

      // chunk into parallel batches
      const chunks: { id: string; mediaType: "image" | "video" }[][] = []
      for (let i = 0; i < toRequest.length; i += CHUNK_SIZE) {
        chunks.push(toRequest.slice(i, i + CHUNK_SIZE))
      }

      const requests = chunks.map((chunk) => {
        const body: PopularityBatchBody = {
          items: chunk.map((c) => ({ id: c.id, mediaType: c.mediaType })),
          ...(upvotesSinceDays ? { upvotesSinceDays } : {}),
        }
        return popularityBatch(body)
      })

      try {
        const settled = await Promise.allSettled(requests)
        const allItems: PopularityBatch200Item[] = []
        for (const r of settled) {
          if (r.status === "fulfilled") {
            const data = r.value?.data || []
            allItems.push(...data)
          } else {
            console.error("[popularityStore] batch request failed", r.reason)
          }
        }
        if (allItems.length) {
          const mapped: PopularityEntry[] = allItems.map((p) => ({
            id: p.id,
            mediaType: uniqueById.get(p.id)?.mediaType,
            favorites: p.favorites ?? 0,
            upvotes: p.upvotes ?? 0,
            downvotes: p.downvotes ?? 0,
            isFavoritedByMe: p.isFavoritedByMe,
            isUpvotedByMe: p.isUpvotedByMe,
            hidden: p.hidden ?? false,
            updatedAt: Date.now(),
          }))
          await this._putMany(mapped)
        }
      } finally {
        // clear in-flight markers
        for (const it of toRequest) delete this._inFlight[it.id]
      }
    },
    async toggleFavorite(id: string, mediaType?: "image" | "video") {
      await this.init()
      if (this._mutating[id]) return
      this._mutating[id] = true
      try {
        let e = this.entries[id]
        if (!e) {
          e = { id, mediaType, favorites: 0, upvotes: 0, downvotes: 0, hidden: false }
        }
        const type = mediaType || e.mediaType || "image"
        const prev = { ...e }
        const was = !!e.isFavoritedByMe
        e.isFavoritedByMe = !was
        e.favorites = Math.max(0, (e.favorites ?? 0) + (e.isFavoritedByMe ? 1 : -1))
        e.mediaType = type
        await this._put(e)

        const attemptedLike = e.isFavoritedByMe
        try {
          if (e.isFavoritedByMe) {
            await collectionsLikeMedia({ ...(type === "video" ? { videoId: id } : { imageId: id }) })
          } else {
            await collectionsUnlikeMedia({ ...(type === "video" ? { videoId: id } : { imageId: id }) })
          }
        } catch (err) {
          console.error(err)
          this.entries[id] = prev
          await this._put(prev)
          if (attemptedLike) {
            Dialog.create({
              component: LikeMedia,
              componentProps: {
                type,
                userOwnsMedia: false,
                currentMediaId: id,
              },
            }).onOk(async () => {
              try {
                const entry = this.entries[id] || { id, mediaType: type, favorites: 0, upvotes: 0, downvotes: 0, hidden: false }
                if (!entry.isFavoritedByMe) {
                  entry.isFavoritedByMe = true
                  entry.favorites = Math.max(0, (entry.favorites ?? 0) + 1)
                }
                entry.mediaType = type
                await this._put(entry)
                await collectionsLikeMedia({ ...(type === "video" ? { videoId: id } : { imageId: id }) })
              } catch (e2) {
                const cur = this.entries[id]
                if (cur) {
                  cur.isFavoritedByMe = false
                  cur.favorites = Math.max(0, (cur.favorites ?? 0) - 1)
                  await this._put(cur)
                }
              }
            })
          }
          throw err
        }
      } finally {
        delete this._mutating[id]
      }
    },
    async addUpvote(id: string, mediaType?: "image" | "video") {
      await this.init()

      // Simple wallet check to prevent obvious overspending on slow connections
      try {
        const userAuth = useUserAuth()
        if (userAuth.loggedIn) {
          if (!userAuth.upvotesWallet) {
            await userAuth.loadUpvotesWallet()
          }
          if (userAuth.upvotesWallet && userAuth.upvotesWallet.remainingToday <= 0) {
            const resetAt = userAuth.upvotesWallet.resetAt
            const ms = resetAt ? new Date(resetAt).getTime() - Date.now() : 0
            const hrs = ms > 0 ? Math.floor(ms / 3600000) : 0
            const mins = ms > 0 ? Math.floor((ms % 3600000) / 60000) : 0
            const timeStr = ms > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : "soon"
            Dialog.create({
              title: "No Upvotes Left",
              message: `<div style="text-align:center;line-height:1.4;">
                <img src="/upvote-fire-dull.png" alt="no upvotes" style="width:40px;height:40px;margin-bottom:8px;" />
                <div>You’ve used all your upvotes for today.</div>
                <div>They’ll recharge in <b>${timeStr}</b>.</div>
              </div>`,
              html: true,
              ok: { label: "OK", flat: true, color: "primary" },
            })
            return
          }
        }
      } catch (e) {
        // Best-effort: if wallet cannot be loaded, allow the attempt; server will enforce limits
      }

      // Allow parallel upvote calls: no per-id _mutating lock here
      let e = this.entries[id]
      if (!e) {
        e = { id, mediaType, favorites: 0, upvotes: 0, downvotes: 0, hidden: false }
      }
      const type = mediaType || e.mediaType || "image"

      // Optimistic increment (per-call delta)
      const prevIsUpvoted = !!e.isUpvotedByMe
      e.isUpvotedByMe = true
      e.upvotes = (e.upvotes ?? 0) + 1
      e.mediaType = type
      await this._put(e)

      try {
        await upvotesUpvote({ ...(type === "video" ? { videoId: id } : { imageId: id }) })
        // Refresh wallet after successful spend (non-blocking safety)
        try {
          const userAuth = useUserAuth()
          if (userAuth.loggedIn) await userAuth.loadUpvotesWallet()
        } catch (e2) {
          console.error("[popularityStore] failed to refresh upvotes wallet", e2)
        }
      } catch (err) {
        // Per-call rollback: subtract only our optimistic +1 and restore prior state
        const cur = this.entries[id] || e
        cur.upvotes = Math.max(0, (cur.upvotes ?? 0) - 1)
        cur.isUpvotedByMe = prevIsUpvoted
        await this._put(cur)
        throw err
      }
    },
    async downvoteAndHide(id: string, mediaType?: "image" | "video") {
      await this.init()
      if (this._mutating[id]) return
      this._mutating[id] = true
      try {
        let e = this.entries[id]
        if (!e) {
          e = { id, mediaType, favorites: 0, upvotes: 0, downvotes: 0, hidden: false }
        }
        const type = mediaType || e.mediaType || "image"
        const prev = { ...e }
        e.downvotes = (e.downvotes ?? 0) + 1
        e.hidden = true
        e.mediaType = type
        await this._put(e)
        try {
          await upvotesDownvote({ ...(type === "video" ? { videoId: id } : { imageId: id }) })
        } catch (err) {
          this.entries[id] = prev
          await this._put(prev)
          throw err
        }
      } finally {
        delete this._mutating[id]
      }
    },
    async unhide(id: string, mediaType?: "image" | "video") {
      await this.init()
      const e = this.entries[id]
      if (!e) return
      if (this._mutating[id]) return
      this._mutating[id] = true
      const prev = { ...e }
      try {
        e.hidden = false
        await this._put(e)
        const type = mediaType || e.mediaType || "image"
        await upvotesUnhide({ ...(type === "video" ? { videoId: id } : { imageId: id }) })
      } catch (err) {
        this.entries[id] = prev
        await this._put(prev)
        throw err
      } finally {
        delete this._mutating[id]
      }
    },
  },
  persist: false,
})
