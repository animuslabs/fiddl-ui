import { defineStore } from "pinia"
import { openDB, IDBPDatabase } from "idb"
import { userGetUsername } from "src/lib/orval"
import { isRateLimitError } from "src/lib/util"

export interface CreatorEntry {
  id: string
  username: string
  updatedAt: number
}

interface CreatorState {
  entries: Record<string, CreatorEntry>
  _db: IDBPDatabase | null
  _loaded: boolean
  _inFlight: Record<string, Promise<string>>
}

const DB_NAME = "CreatorDB"
const STORE_NAME = "CreatorStore"

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    },
  })
}

export const useCreatorStore = defineStore("creatorStore", {
  state: (): CreatorState => ({
    entries: {},
    _db: null,
    _loaded: false,
    _inFlight: {},
  }),
  getters: {
    getUsername: (state) => (id: string): string | undefined => state.entries[id]?.username || undefined,
  },
  actions: {
    async init() {
      if (this._db) return
      this._db = await getDB()
      if (!this._loaded) {
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
        const entry = cursor.value as CreatorEntry
        this.entries[entry.id] = entry
        cursor = await cursor.continue()
      }
      await tx.done
    },
    async _loadFromDBByIds(ids: string[]) {
      await this.init()
      if (!this._db || !ids.length) return
      const tx = this._db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      for (const id of Array.from(new Set(ids.filter(Boolean)))) {
        try {
          const val = (await store.get(id)) as CreatorEntry | undefined
          if (val) {
            this.entries[id] = val
          }
        } catch (err) {
          console.error("[creatorStore] failed to load from db", id, err)
        }
      }
      await tx.done
    },
    async _put(entry: CreatorEntry) {
      await this.init()
      if (!this._db) return
      await this._db.put(STORE_NAME, entry)
      this.entries[entry.id] = entry
    },
    async _putMany(entries: CreatorEntry[]) {
      await this.init()
      if (!this._db || !entries.length) return
      const tx = this._db.transaction(STORE_NAME, "readwrite")
      for (const entry of entries) {
        await tx.store.put(entry)
        this.entries[entry.id] = entry
      }
      await tx.done
    },
    async rememberMany(creators: { id?: string | null; username?: string | null }[]) {
      const filtered = creators
        .map((c) => ({
          id: c.id?.trim() || "",
          username: c.username?.trim() || "",
        }))
        .filter((c) => c.id && c.username)
      if (!filtered.length) return
      const now = Date.now()
      await this._putMany(filtered.map((c) => ({ ...c, updatedAt: now })))
    },
    async rememberOne(id: string, username: string) {
      const cleanId = id?.trim()
      const cleanUsername = username?.trim()
      if (!cleanId || !cleanUsername) return
      await this._put({ id: cleanId, username: cleanUsername, updatedAt: Date.now() })
    },
    async ensureUsername(id: string): Promise<string> {
      const cleanId = id?.trim()
      if (!cleanId) return ""
      await this.init()

      const existing = this.entries[cleanId]?.username
      if (existing) return existing

      await this._loadFromDBByIds([cleanId])
      const fromDb = this.entries[cleanId]?.username
      if (fromDb) return fromDb

      const inflight = this._inFlight[cleanId]
      if (inflight) return inflight

      const promise = (async (): Promise<string> => {
        try {
          const response = await userGetUsername({ userId: cleanId })
          const username = response?.data || ""
          if (username) {
            await this._put({ id: cleanId, username, updatedAt: Date.now() })
          }
          return username
        } catch (err) {
          if (!isRateLimitError(err)) {
            console.error("[creatorStore] failed to fetch username", cleanId, err)
          }
          throw err
        } finally {
          delete this._inFlight[cleanId]
        }
      })()

      this._inFlight[cleanId] = promise
      return promise
    },
  },
})
