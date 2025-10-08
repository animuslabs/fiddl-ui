import { defineStore } from "pinia"
import { Dialog, Platform } from "quasar"
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
  }),
  actions: {
    startPolling() {
      const auth = useUserAuth()
      if (!auth.loggedIn) return
      if (this._poller) return

      const schedule = (ms: number) => {
        this._poller = setTimeout(run, ms)
      }

      const run = async () => {
        try {
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
        types: ["asyncError"],
        includeSeen: false,
        limit: 25,
      }
      try {
        const { data } = await eventsPrivateEvents(params)
        const events = Array.isArray(data) ? data : []
        const unseenNew = events
          .filter((e) => e.type === "asyncError" && !this._pendingIds.has(e.id))
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
          const payload = this._parse(ev)
          const message = (payload?.message && String(payload.message)) || "An unexpected error occurred."
          await new Promise<void>((resolve) => {
            Dialog.create({
              title: "Generation Error",
              message,
              ok: { label: "OK", color: "primary" },
              persistent: Platform.is.mobile, // avoid accidental dismiss on mobile
            }).onOk(() => resolve())
          })
          try {
            await eventsMarkEventSeen({ eventId: ev.id })
          } catch {
            // If mark seen fails, keep id in pending set to avoid spamming this session
          } finally {
            this._pendingIds.delete(ev.id)
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
  },
})

