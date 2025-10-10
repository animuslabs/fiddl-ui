import { defineStore } from "pinia"
import { Dialog, Platform, LocalStorage } from "quasar"
import {
  eventsPrivateEvents,
  eventsMarkEventSeen,
  type EventsPrivateEvents200Item,
  type EventsPrivateEventsParams,
} from "lib/orval"
import { useUserAuth } from "stores/userAuth"

/**
 * Polls for critical async error events and surfaces them immediately via a popup.
 * These events are kept separate from normal notifications and are marked as seen after display.
 */
export const useAsyncErrorStore = defineStore("asyncErrorStore", {
  state: () => ({
    _poller: null as any,
    _visHandler: null as any,
    _pendingIds: new Set<string>(),
    _showing: false,
    _shownCounts: {} as Record<string, number>,
    // Persist IDs the user has acknowledged (closed the dialog)
    _acked: {} as Record<string, number>, // id -> timestamp (ms)
  }),
  actions: {
    // ---- Persistent acknowledged IDs (prevents re-popups across reloads) ----
    _loadAcked() {
      try {
        const obj = LocalStorage.getItem("asyncErrorAcked") as any
        if (obj && typeof obj === "object") this._acked = { ...obj }
      } catch {
        /* ignore */
      }
    },
    _saveAcked() {
      try {
        const entries = Object.entries(this._acked)
        // Keep only the most recent 200 acknowledgements
        if (entries.length > 220) {
          const sorted = entries
            .map(([id, ts]) => [id, Number(ts) || 0] as [string, number])
            .sort((a, b) => a[1] - b[1])
            .slice(entries.length - 200)
          this._acked = Object.fromEntries(sorted)
        }
        LocalStorage.set("asyncErrorAcked", this._acked)
      } catch {
        /* ignore */
      }
    },
    _isAcked(id: string): boolean {
      if (!this._acked || Object.keys(this._acked).length === 0) this._loadAcked()
      return Boolean((this._acked as any)?.[id])
    },
    _acknowledge(id: string) {
      if (!id) return
      if (!this._acked || Object.keys(this._acked).length === 0) this._loadAcked()
      this._acked[id] = Date.now()
      this._saveAcked()
    },
    async _flushAckedToServer() {
      // Best-effort: try to mark any acked IDs as seen server-side
      try {
        const ids = Object.keys(this._acked || {})
        if (ids.length === 0) return
        await Promise.all(
          ids.map((id) =>
            eventsMarkEventSeen({ eventId: id }).catch(() => undefined),
          ),
        )
      } catch {
        /* ignore */
      }
    },
    // ---- Shown-count bookkeeping (safety cap) ----
    _loadShownCounts() {
      try {
        const obj = LocalStorage.getItem("asyncErrorShownCounts") as any
        if (obj && typeof obj === "object") this._shownCounts = { ...obj }
      } catch {
        /* ignore */
      }
    },
    _saveShownCounts() {
      try {
        // Trim to the most recent 100 entries to avoid unbounded growth
        const entries = Object.entries(this._shownCounts)
        if (entries.length > 120) {
          const limited = Object.fromEntries(entries.slice(entries.length - 100))
          LocalStorage.set("asyncErrorShownCounts", limited)
        } else {
          LocalStorage.set("asyncErrorShownCounts", this._shownCounts)
        }
      } catch {
        /* ignore */
      }
    },
    _getShownCount(id: string): number {
      if (!this._shownCounts || Object.keys(this._shownCounts).length === 0) this._loadShownCounts()
      return Number(this._shownCounts?.[id] || 0)
    },
    _incrementShown(id: string) {
      const next = this._getShownCount(id) + 1
      this._shownCounts[id] = next
      this._saveShownCounts()
    },
    startPolling() {
      const auth = useUserAuth()
      if (!auth.loggedIn) return
      if (this._poller) return

      const schedule = (ms: number) => {
        this._poller = setTimeout(run, ms)
      }

      const run = async () => {
        try {
          // Opportunistically flush any locally acknowledged IDs to server
          await this._flushAckedToServer()
          await this._checkAndDisplay()
        } finally {
          const hidden = typeof document !== "undefined" && document.hidden
          const delay = hidden ? 120_000 : 30_000
          schedule(delay)
        }
      }

      // Kick off immediately and re-arm on tab visibility
      if (typeof document !== "undefined" && !this._visHandler) {
        this._visHandler = () => {
          if (!document.hidden) {
            if (this._poller) {
              clearTimeout(this._poller)
              this._poller = null
            }
            if (typeof document !== "undefined" && this._visHandler) {
              document.removeEventListener("visibilitychange", this._visHandler)
              this._visHandler = null
            }
            schedule(1)
          }
        }
        document.addEventListener("visibilitychange", this._visHandler)
      }
      schedule(1)
    },
    stopPolling() {
      if (this._poller) {
        clearTimeout(this._poller)
        this._poller = null
      }
      // Do not clear pendingIds to prevent duplicate popups within same session
    },
    async _checkAndDisplay() {
      const auth = useUserAuth()
      if (!auth.loggedIn) return
      const params: EventsPrivateEventsParams = {
        // Server expects a CSV string for types per OpenAPI/zod
        types: "asyncError",
        includeSeen: false,
        limit: 25,
      }
      try {
        const { data } = await eventsPrivateEvents(params)
        const events = Array.isArray(data) ? data : []
        const unseenNew = events
          .filter(
            (e) =>
              e.type === "asyncError" &&
              !this._pendingIds.has(e.id) &&
              // Never re-surface an event the user already acknowledged
              !this._isAcked(e.id) &&
              this._getShownCount(e.id) < 2,
          )
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        for (const ev of unseenNew) this._pendingIds.add(ev.id)
        if (unseenNew.length > 0) await this._drainQueueSequential(unseenNew)
      } catch {
        // silent
      }
    },
    async _drainQueueSequential(queue: EventsPrivateEvents200Item[]) {
      if (this._showing) return // another drain is in progress
      this._showing = true
      try {
        for (const ev of queue) {
          // Skip if already shown twice in this or a previous session
          if (this._getShownCount(ev.id) >= 2) continue
          const payload = this._parse(ev)
          const message = this._buildMessage(ev, payload)
          await new Promise<void>((resolve) => {
            const dlg = Dialog.create({
              title: "Generation Error",
              message,
              ok: { label: "OK", color: "primary" },
              persistent: Platform.is.mobile, // avoid accidental dismiss on mobile
            })
            // Consider any dismissal (OK, click-away, ESC) as acknowledged
            dlg.onOk(() => resolve())
            dlg.onDismiss(() => resolve())
          })
          // Count this display regardless of server state
          this._incrementShown(ev.id)
          // Persist local acknowledgement immediately so it won't reappear on reload
          this._acknowledge(ev.id)
          try {
            await eventsMarkEventSeen({ eventId: ev.id })
            // On success, remove from pending set so store stays tidy
            this._pendingIds.delete(ev.id)
          } catch {
            // If mark seen fails, keep id in pending set to avoid spamming.
            // It will be naturally cleared on reload; shown-count also enforces a hard cap.
          }
        }
      } finally {
        this._showing = false
      }
    },
    _parse(ev: EventsPrivateEvents200Item): any {
      try {
        return JSON.parse(ev.dataJSON)
      } catch {
        return null
      }
    },
    _buildMessage(ev: EventsPrivateEvents200Item, payload: any): string {
      const p = payload || {}
      const type = String(
        p.mediaType || p.media_type || (p.videoId || p.video_id ? "video" : p.imageId || p.image_id ? "image" : "item"),
      )
      const refund = [
        p.refund,
        p.refunded,
        p.refundPoints,
        p.refundedPoints,
        p.pointsRefunded,
        p.refund_points,
      ].find((v: any) => typeof v === "number")
      const reason = String(p.reason || p.error || p.message || "").trim()

      const base = `We hit an issue generating your ${type}.`
      const refundMsg = typeof refund === "number" && refund > 0 ? ` A refund of ${refund} points was applied to your account.` : ""
      const reasonMsg = reason ? `\n\nDetails: ${reason}` : ""
      return `${base}${refundMsg}${reasonMsg}`
    },
  },
})
