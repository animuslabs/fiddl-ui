import { defineStore } from "pinia"
import { motdAvailable, motdGet, motdMarkRead, type MotdAvailable200Item, type MotdGet200 } from "lib/orval"

export interface MotdMessage {
  id: string
  title: string
  subheading: string | null
  body: string
  createdAt: string
  updatedAt: string
  startsAt: string
  expiresAt: string | null
  readAt: string | null
}

interface MotdState {
  latest: MotdMessage | null
  dialogVisible: boolean
  dialogBypassGuard: boolean
  acknowledgedMap: Record<string, number>
  refreshing: boolean
  lastError: string | null
  markInFlight: Record<string, boolean>
  pollTimer: number | null
}

function mapMotd(detail: MotdGet200, meta?: MotdAvailable200Item | null): MotdMessage {
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
}

export const useMotdStore = defineStore("motdStore", {
  state: (): MotdState => ({
    latest: null,
    dialogVisible: false,
    dialogBypassGuard: false,
    acknowledgedMap: {},
    refreshing: false,
    lastError: null,
    markInFlight: {},
    pollTimer: null,
  }),
  getters: {
    hasMessage(state): boolean {
      return Boolean(state.latest)
    },
    bannerVisible(state): boolean {
      const current = state.latest
      if (!current) return false
      if (current.readAt) return false
      return !state.acknowledgedMap?.[current.id]
    },
    unreadCount(state): number {
      const current = state.latest
      if (!current) return 0
      if (current.readAt) return 0
      return state.acknowledgedMap?.[current.id] ? 0 : 1
    },
  },
  actions: {
    setLatest(message: MotdMessage | null) {
      if (!message) {
        this.latest = null
        this.dialogVisible = false
        this.dialogBypassGuard = false
        return
      }
      const incomingId = String(message.id)
      const currentId = this.latest?.id
      const changed = !currentId || currentId !== incomingId
      this.latest = { ...message, id: incomingId }
      if (message.readAt) this._markAcknowledged(incomingId)
      if (changed) {
        this.dialogVisible = !this.isAcknowledged(incomingId) && !message.readAt
        this.dialogBypassGuard = false
      } else if (!this.isAcknowledged(incomingId) && !this.dialogVisible && !message.readAt) {
        // Re-open if the user has never acknowledged this message yet
        this.dialogVisible = true
        this.dialogBypassGuard = false
      }
    },
    showDialog(force = false) {
      if (!this.latest) return
      this.dialogBypassGuard = Boolean(force)
      this.dialogVisible = true
    },
    closeDialog(markAsRead = true) {
      this.dialogVisible = false
      this.dialogBypassGuard = false
      if (markAsRead) void this.markCurrentAsRead()
    },
    acknowledgeCurrent(markRead = true) {
      if (!this.latest) return
      this.dialogBypassGuard = false
      void this.markCurrentAsRead(markRead)
    },
    clearDialogBypass() {
      this.dialogBypassGuard = false
    },
    startPolling(intervalMs = 180000) {
      if (typeof window === "undefined") return
      this.stopPolling()
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) return
      const tick = () => {
        void this.refreshLatest()
      }
      this.pollTimer = window.setInterval(tick, intervalMs)
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    async markCurrentAsRead(markRead = true): Promise<void> {
      if (!this.latest) return
      const id = this.latest.id
      this._markAcknowledged(id)
      if (!markRead) return
      if (this.latest.readAt) return
      if (this.markInFlight[id]) return
      this.markInFlight = { ...this.markInFlight, [id]: true }
      try {
        const { data } = await motdMarkRead({ id })
        if (data?.readAt) {
          const readAt = data.readAt
          if (this.latest?.id === id) {
            this.latest = { ...this.latest, readAt }
          }
        }
      } catch (err) {
        // Swallow errors but record for debugging
        this.lastError = err instanceof Error ? err.message : "Failed to mark MOTD as read"
      } finally {
        const { [id]: _omit, ...rest } = this.markInFlight
        this.markInFlight = rest
      }
    },
    async refreshLatest(): Promise<void> {
      if (this.refreshing) return
      this.refreshing = true
      this.lastError = null
      try {
        const { data: available } = await motdAvailable({ includeRead: true })
        const items = Array.isArray(available) ? available : []
        if (items.length === 0) {
          this.setLatest(null)
          return
        }
        const sorted = [...items].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
        const latestMeta = sorted[0]
        if (!latestMeta) {
          this.setLatest(null)
          return
        }
        const { data } = await motdGet({ id: latestMeta.id })
        const message = mapMotd(data, latestMeta)
        this.setLatest(message)
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : "Failed to load MOTD"
      } finally {
        this.refreshing = false
      }
    },
    isAcknowledged(id: string): boolean {
      if (!id) return false
      return Boolean(this.acknowledgedMap?.[id])
    },
    _markAcknowledged(id: string) {
      if (!id) return
      this.acknowledgedMap = { ...this.acknowledgedMap, [id]: Date.now() }
    },
  },
  persist: {
    key: "motd",
    pick: ["acknowledgedMap"],
  },
})
