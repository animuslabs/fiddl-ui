import { metaPixel } from "lib/metaPixel"
import umami from "lib/umami"
import { tmaAnalytics } from "lib/tmaAnalytics"
import { tiktokPixel } from "lib/tiktokPixel"
import { getTikTokAttribution } from "lib/tiktokAttribution"
import { tiktokCompleteRegistration, marketingAddToCart, marketingInitiateCheckout, marketingCreateImageStart, marketingCreateImageSuccess, marketingCreateVideoStart, marketingCreateVideoSuccess } from "lib/orval"
import SHA256 from "crypto-js/sha256"
import encHex from "crypto-js/enc-hex"
import { getMetaAttribution, generateEventId } from "./metaAttribution"
import datafast from "lib/datafast"
import { getCookie } from "lib/util"
import { gtm } from "lib/googleTagManager"

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

  // Remove undefined values and coerce to our Json union at runtime
  private sanitize(input: Record<string, any>): Record<string, Json> {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(input || {})) {
      if (typeof v === "undefined") continue
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = v as Json
      } else if (Array.isArray(v)) {
        out[k] = v.filter((x) => typeof x !== "undefined").map((x) => (typeof x === "object" && x ? this.sanitize(x as any) : (x as any))) as any
      } else if (typeof v === "object") {
        out[k] = this.sanitize(v as any)
      }
    }
    return out
  }

  // Map our common payload shape to GA4-friendly parameters for GTM
  private ga4ify(eventName: string, payload: Record<string, Json> = {}): Record<string, Json> {
    try {
      const out: Record<string, Json> = { ...payload }
      // Map contents -> items for GA4 ecommerce
      const maybeContents = (payload as any)?.contents
      const contentName = (payload as any)?.content_name
      if (Array.isArray(maybeContents)) {
        const items = maybeContents
          .filter((it: any) => it && typeof it === "object")
          .map((it: any) => {
            const item: Record<string, Json> = {}
            if (it.id != null) item["item_id"] = String(it.id)
            if (typeof it.quantity !== "undefined") item["quantity"] = Number(it.quantity)
            if (typeof it.item_price !== "undefined") item["price"] = Number(it.item_price)
            if (typeof contentName !== "undefined") item["item_name"] = String(contentName)
            return item
          })
        if (items.length) out.items = items as any
      }
      // Add transaction_id for purchase when available (prefer explicit prop)
      if (eventName === "purchase") {
        const txId = (payload as any)?.transaction_id || (payload as any)?.transactionId || (payload as any)?.orderId || (payload as any)?.orderID
        if (txId) out.transaction_id = String(txId)
      }
      return out
    } catch {
      return payload
    }
  }

  /** Section/page open tracking (e.g., magic mirror, forge, missions) */
  sectionOpen(section: string, extra?: Record<string, Json>): void {
    const sec = String(section || "").trim() || "unknown"
    const payload: Record<string, Json> = { section: sec, ...(extra || {}) }
    if (this._debug) console.info("[Events] sectionOpen", payload)
    try {
      // metaPixel.trackCustom("SectionOpen", payload as any)
    } catch {}
    try {
      // tiktokPixel.track("SectionOpen", payload as any)
    } catch {}
    try {
      // umami.track("sectionOpen", payload) // not needed, we already track page views
    } catch {}
    try {
      // datafast.goal(`${sec}_open`, payload) // not needed, we already track page views
    } catch {}
    try {
      // gtm.track("section_open", payload)
    } catch {}
  }

  /** Promo code successfully claimed */
  promoClaimed(data: { code?: string; points?: number } = {}): void {
    const payload: Record<string, Json> = { ...data }
    if (this._debug) console.info("[Events] promoClaimed", payload)
    try {
      metaPixel.trackCustom("PromoClaimed", payload as any)
    } catch {}
    try {
      tiktokPixel.track("PromoClaimed", payload as any)
    } catch {}
    try {
      umami.track("promoClaimed", payload)
    } catch {}
    try {
      datafast.goal("promo_claimed", payload)
    } catch {}
    try {
      gtm.track("promo_claimed", payload)
    } catch {}
  }

  /** Mission reward claimed */
  missionClaimed(data: { missionId: string; rewards?: Array<{ type: string; amount?: number; badgeId?: string }> }): void {
    const payload: Record<string, Json> = { mission_id: data.missionId }
    if (Array.isArray(data?.rewards)) {
      payload.rewards = data.rewards.map((r) => {
        const o: Record<string, Json> = { type: String(r.type) }
        if (typeof r.amount !== "undefined") o.amount = Number(r.amount)
        if (typeof r.badgeId !== "undefined") o.badgeId = String(r.badgeId)
        return o
      })
    }
    if (this._debug) console.info("[Events] missionClaimed", payload)
    try {
      metaPixel.trackCustom("MissionClaimed", payload as any)
    } catch {}
    try {
      tiktokPixel.track("MissionClaimed", payload as any)
    } catch {}
    try {
      umami.track("missionClaimed", payload)
    } catch {}
    try {
      datafast.goal("mission_claimed", payload)
    } catch {}
    try {
      gtm.track("mission_claimed", payload)
    } catch {}
  }

  /** Magic Mirror session completed (all expected images rendered) */
  magicMirrorCompleted(mode: "fast" | "pro", data: { images?: number; templates?: number } = {}): void {
    const payload: Record<string, Json> = { mode, ...data }
    if (this._debug) console.info("[Events] magicMirrorCompleted", payload)
    try {
      metaPixel.trackCustom("MagicMirrorCompleted", payload as any)
    } catch {}
    try {
      tiktokPixel.track("MagicMirrorCompleted", payload as any)
    } catch {}
    try {
      umami.track("magicMirrorCompleted", payload)
    } catch {}
    try {
      datafast.goal("magic_mirror_completed", payload)
    } catch {}
    try {
      gtm.track("magic_mirror_completed", payload)
    } catch {}
  }

  /** Forge: training set created */
  trainingSetCreated(data: { trainingSetId: string; name?: string; images?: number }): void {
    const payload: Record<string, Json> = { ...data }
    if (this._debug) console.info("[Events] trainingSetCreated", payload)
    try {
      metaPixel.trackCustom("TrainingSetCreated", payload as any)
    } catch {}
    try {
      tiktokPixel.track("TrainingSetCreated", payload as any)
    } catch {}
    try {
      umami.track("trainingSetCreated", payload)
    } catch {}
    try {
      datafast.goal("training_set_created", payload)
    } catch {}
    try {
      gtm.track("training_set_created", payload)
    } catch {}
  }

  /** Forge: custom model created */
  customModelCreated(data: { customModelId: string; trainingSetId?: string; baseModel?: string; fineTuneType?: string; modelMode?: string; name?: string }): void {
    const payload: Record<string, Json> = { ...data }
    if (this._debug) console.info("[Events] customModelCreated", payload)
    try {
      metaPixel.trackCustom("CustomModelCreated", payload as any)
    } catch {}
    try {
      tiktokPixel.track("CustomModelCreated", payload as any)
    } catch {}
    try {
      umami.track("customModelCreated", payload)
    } catch {}
    try {
      datafast.goal("custom_model_created", payload)
    } catch {}
    try {
      gtm.track("custom_model_created", payload)
    } catch {}
  }

  init(options: { debug?: boolean } = {}): void {
    this._debug = !!options.debug
    // Initialize wrappers that benefit from explicit init without injecting scripts
    tiktokPixel.init({ debug: this._debug })
    gtm.init({ debug: this._debug })
    // metaPixel: assumed loaded/initialized via index.html; wrapper is ready if fbq exists
  }

  /** Item added to cart */
  addToCart(data: { contents?: Array<Record<string, Json>>; content_type?: string; currency?: string; value?: number; content_name?: string; num_items?: number }): void {
    const payload = data || {}
    const event_id = generateEventId()
    if (this._debug) console.info("[Events] addToCart", payload)
    try {
      metaPixel.trackAddToCart({ ...(payload as any), event_id })
    } catch {}
    try {
      tiktokPixel.trackAddToCart(payload as any)
    } catch {}
    try {
      umami.track("addToCart", payload)
    } catch {}
    try {
      datafast.goal("add_to_cart", payload as any)
    } catch {}
    try {
      gtm.track("add_to_cart", this.ga4ify("add_to_cart", payload))
    } catch {}
    try {
      if (typeof window !== "undefined") {
        const { fbp, fbc, eventSourceUrl, userAgent } = getMetaAttribution()
        const trackingId = getCookie("datafast_visitor_id") || undefined
        void marketingAddToCart({
          currency: (payload as any).currency,
          value: (payload as any).value,
          contents: (payload as any).contents,
          content_type: (payload as any).content_type,
          num_items: (payload as any).num_items,
          fbp,
          fbc,
          eventId: event_id,
          eventSourceUrl,
          userAgent,
          ...(trackingId ? ({ trackingId } as any) : {}),
        } as any).catch((err) => this._debug && console.warn("[Events] marketing.addToCart failed", err))
      }
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
    try {
      datafast.goal("search", payload)
    } catch {}
    try {
      gtm.track("search", payload)
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
    try {
      gtm.pageView(extra)
    } catch {}
    // Umami generally auto-tracks pageviews; avoid double-counting.
    // DataFast auto-tracks pageviews as well via the script.
  }

  /** Media creation lifecycle */
  createStart(kind: "image" | "video", meta?: Record<string, Json>): void {
    const payload = { kind, ...(meta || {}) }
    const event_id = generateEventId()
    if (this._debug) console.info("[Events] createStart", payload)
    try {
      tmaAnalytics.createStart(kind, meta || {})
    } catch {}
    try {
      umami.track(kind === "image" ? "createImageStart" : "createVideoStart", payload)
    } catch {}
    try {
      metaPixel.trackCustom(kind === "image" ? "CreateImageStart" : "CreateVideoStart", { ...payload, event_id })
    } catch {}
    try {
      tiktokPixel.track(kind === "image" ? "CreateImageStart" : "CreateVideoStart", payload as any)
    } catch {}
    try {
      const ev = kind === "image" ? "create_image_start" : "create_video_start"
      datafast.goal(ev, payload)
    } catch {}
    try {
      gtm.track(kind === "image" ? "create_image_start" : "create_video_start", payload)
    } catch {}
    try {
      if (typeof window !== "undefined") {
        const { fbp, fbc, eventSourceUrl, userAgent } = getMetaAttribution()
        const eventSourceUrlS = (eventSourceUrl || (typeof window !== "undefined" ? window.location.href : "")) as string
        const userAgentS = (userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")) as string
        const model = (meta || {}).model as string | undefined
        const modelS = (model || "") as string
        if (kind === "image") {
          {
            const trackingId = getCookie("datafast_visitor_id") || undefined
            void marketingCreateImageStart({
              model: modelS,
              ...(fbp ? ({ fbp } as any) : {}),
              ...(fbc ? ({ fbc } as any) : {}),
              eventId: event_id,
              eventSourceUrl: eventSourceUrlS,
              userAgent: userAgentS,
              ...(trackingId ? ({ trackingId } as any) : {}),
            } as any).catch((err) => this._debug && console.warn("[Events] marketing.createImageStart failed", err))
          }
        } else {
          {
            const trackingId = getCookie("datafast_visitor_id") || undefined
            void marketingCreateVideoStart({
              model: modelS,
              ...(fbp ? ({ fbp } as any) : {}),
              ...(fbc ? ({ fbc } as any) : {}),
              eventId: event_id,
              eventSourceUrl: eventSourceUrlS,
              userAgent: userAgentS,
              ...(trackingId ? ({ trackingId } as any) : {}),
            } as any).catch((err) => this._debug && console.warn("[Events] marketing.createVideoStart failed", err))
          }
        }
      }
    } catch {}
  }

  createSuccess(kind: "image" | "video", meta?: Record<string, Json>): void {
    const payload = { kind, ...(meta || {}) }
    const event_id = generateEventId()
    if (this._debug) console.info("[Events] createSuccess", payload)
    try {
      tmaAnalytics.createSuccess(kind, meta || {})
    } catch {}
    try {
      umami.track(kind === "image" ? "createImageSuccess" : "createVideoSuccess", payload)
    } catch {}
    try {
      metaPixel.trackCustom(kind === "image" ? "CreateImageSuccess" : "CreateVideoSuccess", { ...payload, event_id })
    } catch {}
    try {
      tiktokPixel.track(kind === "image" ? "CreateImageSuccess" : "CreateVideoSuccess", payload as any)
    } catch {}
    try {
      const ev = kind === "image" ? "create_image_success" : "create_video_success"
      datafast.goal(ev, payload)
    } catch {}
    try {
      gtm.track(kind === "image" ? "create_image_success" : "create_video_success", payload)
    } catch {}
    try {
      if (typeof window !== "undefined") {
        const { fbp, fbc, eventSourceUrl, userAgent } = getMetaAttribution()
        const eventSourceUrlS = (eventSourceUrl || (typeof window !== "undefined" ? window.location.href : "")) as string
        const userAgentS = (userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")) as string
        const model = (meta || {}).model as string | undefined
        const modelS = (model || "") as string
        if (kind === "image") {
          {
            const trackingId = getCookie("datafast_visitor_id") || undefined
            void marketingCreateImageSuccess({
              model: modelS,
              ...(fbp ? ({ fbp } as any) : {}),
              ...(fbc ? ({ fbc } as any) : {}),
              eventId: event_id,
              eventSourceUrl: eventSourceUrlS,
              userAgent: userAgentS,
              ...(trackingId ? ({ trackingId } as any) : {}),
            } as any).catch((err) => this._debug && console.warn("[Events] marketing.createImageSuccess failed", err))
          }
        } else {
          {
            const trackingId = getCookie("datafast_visitor_id") || undefined
            void marketingCreateVideoSuccess({
              model: modelS,
              ...(fbp ? ({ fbp } as any) : {}),
              ...(fbc ? ({ fbc } as any) : {}),
              eventId: event_id,
              eventSourceUrl: eventSourceUrlS,
              userAgent: userAgentS,
              ...(trackingId ? ({ trackingId } as any) : {}),
            } as any).catch((err) => this._debug && console.warn("[Events] marketing.createVideoSuccess failed", err))
          }
        }
      }
    } catch {}
  }

  /** Checkout lifecycle */
  purchaseInitiated(data?: Record<string, Json>): void {
    const payload = data || {}
    const event_id = generateEventId()
    if (this._debug) console.info("[Events] purchaseInitiated", payload)
    try {
      metaPixel.trackInitiateCheckout({ ...(payload as any), event_id })
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
    try {
      // datafast.goal("checkout_initiated", payload as any) // handled on the server
    } catch {}
    try {
      gtm.track("begin_checkout", this.ga4ify("begin_checkout", payload))
    } catch {}
    try {
      if (typeof window !== "undefined") {
        const { fbp, fbc, eventSourceUrl, userAgent } = getMetaAttribution()
        const trackingId = getCookie("datafast_visitor_id") || undefined
        void marketingInitiateCheckout({
          currency: (payload as any).currency,
          value: (payload as any).value,
          contents: (payload as any).contents,
          content_type: (payload as any).content_type,
          num_items: (payload as any).num_items,
          fbp,
          fbc,
          eventId: event_id,
          eventSourceUrl,
          userAgent,
          ...(trackingId ? ({ trackingId } as any) : {}),
        } as any).catch((err) => this._debug && console.warn("[Events] marketing.initiateCheckout failed", err))
      }
    } catch {}
  }

  purchaseCompleted(data: PurchaseEvent): void {
    const maybeEventId = generateEventId()
    const payload: PurchaseEvent = (maybeEventId ? { ...data, event_id: maybeEventId } : { ...data }) as any
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
    try {
      datafast.goal("purchase_completed", payload as any)
    } catch {}
    try {
      // Align to GA4 recommended payload (add items + transaction_id)
      gtm.track("purchase", this.ga4ify("purchase", payload as any))
    } catch {}
  }

  /** Login to existing account */
  login(data?: Record<string, Json>): void {
    const payload = data || {}
    if (this._debug) console.info("[Events] login", payload)
    try {
      // Meta/Facebook: use a custom event name
      metaPixel.trackCustom("Login", payload as any)
    } catch {}
    try {
      // TikTok: custom event also named "Login"
      tiktokPixel.track("Login", payload as any)
    } catch {}
    try {
      umami.track("login", payload)
    } catch {}
    try {
      datafast.goal("login", payload)
    } catch {}
    try {
      gtm.track("login", payload)
    } catch {}
  }

  /** Registration completion */
  registrationCompleted(data?: Record<string, Json>): void {
    const event_id = generateEventId()
    const payload = { ...(data || {}), event_id }
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
        const { fbp, fbc, eventSourceUrl } = getMetaAttribution()
        const trackingId = getCookie("datafast_visitor_id") || undefined
        void tiktokCompleteRegistration({ ttclid, ttp, userAgent, eventId, trackingId, fbp, fbc, eventSourceUrl }).catch((err) => {
          if (this._debug) console.warn("[Events] TikTok server registration fallback failed", err)
        })
      }
    } catch (err) {
      if (this._debug) console.warn("[Events] TikTok registration fallback threw", err)
    }
    try {
      umami.track("registrationCompleted", payload)
    } catch {}
    try {
      // DataFast: emit "complete_registration" to match expected reporting
      datafast.goal("complete_registration", payload)
    } catch {}
    try {
      // GA4 recommended name
      gtm.track("sign_up", this.sanitize(payload))
    } catch {}
  }

  /** Optional: propagate identifiers */
  identify(user: IdentifyEvent): void {
    if (this._debug) console.info("[Events] identify", user)
    try {
      if (user.userId || user.userName) umami.identify({ userId: String(user.userId || ""), userName: user.userName as any })
    } catch {}
    try {
      if (user.userId) {
        datafast.identify({ user_id: String(user.userId), name: user.userName ? String(user.userName) : undefined })
      }
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
