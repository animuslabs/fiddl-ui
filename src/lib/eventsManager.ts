import { metaPixel } from "lib/metaPixel"
import umami from "lib/umami"
import { tmaAnalytics } from "lib/tmaAnalytics"
import { tiktokPixel } from "lib/tiktokPixel"
import { getTikTokAttribution } from "lib/tiktokAttribution"
import { tiktokCompleteRegistration } from "lib/orval"
import SHA256 from "crypto-js/sha256"
import encHex from "crypto-js/enc-hex"

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

export interface PurchaseEvent {
  value: number
  currency: string
  method?: string
  contents?: Array<{ id: string | number; quantity?: number; item_price?: number }>
  event_id?: string
  // Additional free-form fields allowed
  // (kept loose here to avoid strict index signature conflicts)
  [k: string]: any
}

export interface IdentifyEvent {
  userId?: string
  userName?: string
  emailHash?: string
  phoneHash?: string
  external_id?: string
  [k: string]: any
}

/**
 * Unified, lightweight event dispatcher
 *
 * Goals:
 * - Keep it simple: best-effort fan-out to available destinations
 * - SSR safe: all functions no-op on server
 * - Do not duplicate auto-tracked events (e.g., Umami pageviews)
 */
class EventsManager {
  private _debug = false

  init(options: { debug?: boolean } = {}): void {
    this._debug = !!options.debug
    // Initialize wrappers that benefit from explicit init without injecting scripts
    tiktokPixel.init({ debug: this._debug })
    // metaPixel: assumed loaded/initialized via index.html; wrapper is ready if fbq exists
  }

  /** Item added to cart */
  addToCart(data: {
    contents?: Array<Record<string, Json>>
    content_type?: string
    currency?: string
    value?: number
    content_name?: string
    num_items?: number
  }): void {
    const payload = data || {}
    if (this._debug) console.info("[Events] addToCart", payload)
    try {
      metaPixel.trackAddToCart(payload as any)
    } catch {}
    try {
      tiktokPixel.trackAddToCart(payload as any)
    } catch {}
    try {
      umami.track("addToCart", payload)
    } catch {}
  }

  /** Search performed from browse page */
  search(query: string): void {
    const q = String(query || "").trim()
    if (!q) return
    const payload: Record<string, Json> = { search_string: q, query: q }
    if (this._debug) console.info("[Events] search", payload)
    try {
      metaPixel.trackSearch(payload as any)
    } catch {}
    try {
      tiktokPixel.trackSearch(payload as any)
    } catch {}
    try {
      umami.track("search", payload)
    } catch {}
  }

  /** SPA page navigation */
  pageView(extra?: Record<string, Json>): void {
    if (this._debug) console.info("[Events] pageView", extra || {})
    try {
      metaPixel.trackPageView()
    } catch {}
    try {
      tiktokPixel.trackPageView(extra as any)
    } catch {}
    // Umami generally auto-tracks pageviews; avoid double-counting.
  }

  /** Media creation lifecycle */
  createStart(kind: "image" | "video", meta?: Record<string, Json>): void {
    const payload = { kind, ...(meta || {}) }
    if (this._debug) console.info("[Events] createStart", payload)
    try {
      tmaAnalytics.createStart(kind, meta || {})
    } catch {}
    try {
      umami.track(kind === "image" ? "createImageStart" : "createVideoStart", payload)
    } catch {}
    try {
      metaPixel.trackCustom(kind === "image" ? "CreateImageStart" : "CreateVideoStart", payload)
    } catch {}
    try {
      tiktokPixel.track(kind === "image" ? "CreateImageStart" : "CreateVideoStart", payload as any)
    } catch {}
  }

  createSuccess(kind: "image" | "video", meta?: Record<string, Json>): void {
    const payload = { kind, ...(meta || {}) }
    if (this._debug) console.info("[Events] createSuccess", payload)
    try {
      tmaAnalytics.createSuccess(kind, meta || {})
    } catch {}
    try {
      umami.track(kind === "image" ? "createImageSuccess" : "createVideoSuccess", payload)
    } catch {}
    try {
      metaPixel.trackCustom(kind === "image" ? "CreateImageSuccess" : "CreateVideoSuccess", payload)
    } catch {}
    try {
      tiktokPixel.track(kind === "image" ? "CreateImageSuccess" : "CreateVideoSuccess", payload as any)
    } catch {}
  }

  /** Checkout lifecycle */
  purchaseInitiated(data?: Record<string, Json>): void {
    const payload = data || {}
    if (this._debug) console.info("[Events] purchaseInitiated", payload)
    try {
      metaPixel.trackInitiateCheckout(payload as any)
    } catch {}
    try {
      tiktokPixel.trackInitiateCheckout(payload as any)
    } catch {}
    try {
      tmaAnalytics.purchaseIntent((payload as any).method as any, payload)
    } catch {}
    try {
      umami.track("purchaseInitiated", payload)
    } catch {}
  }

  purchaseCompleted(data: PurchaseEvent): void {
    const payload = data
    if (this._debug) console.info("[Events] purchaseCompleted", payload)
    try {
      metaPixel.trackPurchase(payload as any)
    } catch {}
    try {
      const { value, currency, ...rest } = payload as any
      tiktokPixel.trackPurchase({ value, currency, ...rest })
    } catch {}
    try {
      tmaAnalytics.purchaseSuccess((payload as any).method as any, payload)
    } catch {}
    try {
      umami.track("purchaseCompleted", payload as any)
    } catch {}
  }

  /** Registration completion */
  registrationCompleted(data?: Record<string, Json>): void {
    const payload = data || {}
    if (this._debug) console.info("[Events] registrationCompleted", payload)
    try {
      metaPixel.trackCompleteRegistration(payload as any)
    } catch {}
    try {
      tiktokPixel.trackCompleteRegistration(payload as any)
    } catch {}
    try {
      if (typeof window !== "undefined") {
        const { ttclid, ttp, userAgent } = getTikTokAttribution()
        const maybeEventId = (payload as Record<string, any>)?.event_id
        const eventId = typeof maybeEventId === "string" ? maybeEventId : undefined
        void tiktokCompleteRegistration({ ttclid, ttp, userAgent, eventId }).catch((err) => {
          if (this._debug) console.warn("[Events] TikTok server registration fallback failed", err)
        })
      }
    } catch (err) {
      if (this._debug) console.warn("[Events] TikTok registration fallback threw", err)
    }
    try {
      umami.track("registrationCompleted", payload)
    } catch {}
  }

  /** Optional: propagate identifiers */
  identify(user: IdentifyEvent): void {
    if (this._debug) console.info("[Events] identify", user)
    try {
      if (user.userId || user.userName) umami.identify({ userId: String(user.userId || ""), userName: user.userName as any })
    } catch {}
    try {
      const am: Record<string, string> = {}
      const emailHashed = this.hashSha256IfNeeded(user.emailHash, /*email*/ true)
      // Normalize phone to digits-only before hashing when not already hashed
      const phoneRaw = user.phoneHash
      const phoneNormalized = phoneRaw && !/^[a-f0-9]{64}$/i.test(String(phoneRaw)) ? String(phoneRaw).replace(/[^0-9]/g, "") : phoneRaw
      const phoneHashed = this.hashSha256IfNeeded(phoneNormalized)
      if (emailHashed) am.em = emailHashed
      if (phoneHashed) am.ph = phoneHashed
      if (user.external_id) (am as any).external_id = String(user.external_id)
      if (Object.keys(am).length) metaPixel.setAdvancedMatching(am as any)
    } catch {}
    try {
      const tk: Record<string, any> = {}
      if (user.external_id) tk.external_id = user.external_id
      const emailHashed = this.hashSha256IfNeeded(user.emailHash, /*email*/ true)
      const phoneRaw = user.phoneHash
      const phoneNormalized = phoneRaw && !/^[a-f0-9]{64}$/i.test(String(phoneRaw)) ? String(phoneRaw).replace(/[^0-9]/g, "") : phoneRaw
      const phoneHashed = this.hashSha256IfNeeded(phoneNormalized)
      if (emailHashed) tk.email = emailHashed
      if (phoneHashed) tk.phone_number = phoneHashed
      if (Object.keys(tk).length) tiktokPixel.identify(tk)
    } catch {}
  }

  private hashSha256IfNeeded(value?: string, lowerBeforeHash = false): string | undefined {
    if (!value) return undefined
    const v = String(value)
    const maybeNorm = lowerBeforeHash ? v.trim().toLowerCase() : v.trim()
    // Already a sha256 hex?
    if (/^[a-f0-9]{64}$/i.test(maybeNorm)) return maybeNorm.toLowerCase()
    try {
      return SHA256(maybeNorm).toString(encHex).toLowerCase()
    } catch {
      return undefined
    }
  }
}

export const events = new EventsManager()
