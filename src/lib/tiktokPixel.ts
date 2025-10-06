/**
 * TikTok Pixel utility
 *
 * Notes:
 * - Safe in SSR: no-ops when window/document are unavailable
 * - Assumes the Pixel script is already loaded in index.html
 * - Mirrors Meta pixel helper shape where sensible
 */

declare global {
  interface Window {
    ttq?: TTQ
  }
}

type TTQ = {
  (...args: any[]): void
  page?: (payload?: Record<string, any>) => void
  track?: (event: string, payload?: Record<string, any>) => void
  identify?: (payload: Record<string, any>) => void
  ready?: (cb: () => void) => void
}

export interface TikTokInitOptions {
  /** Enable console logging of pixel activity for debugging */
  debug?: boolean
}

export class TikTokPixel {
  private _initialized = false
  private _debug = false

  init(options: TikTokInitOptions = {}): void {
    if (!this.isBrowser()) return
    this._debug = !!options.debug
    if (window.ttq && typeof window.ttq === "function") {
      this._initialized = true
      if (this._debug) console.info("[TikTokPixel] initialized (script present)")
    } else {
      if (this._debug) console.warn("[TikTokPixel] init: ttq not present; will no-op until available")
    }
  }

  /** Track a standard or custom event */
  track(event: string, payload?: Record<string, any>): void {
    if (!this.canTrack()) return
    const normalized = this.normalizePayload(payload)
    if (this._debug) console.info("[TikTokPixel] track", event, normalized || {})
    try {
      window.ttq!.track?.(event, normalized || {})
    } catch (e) {
      if (this._debug) console.warn("[TikTokPixel] track failed", e)
    }
  }

  /** Track SPA page view (index already fires initial page view) */
  trackPageView(payload?: Record<string, any>): void {
    if (!this.canTrack()) return
    if (this._debug) console.info("[TikTokPixel] page", payload || {})
    try {
      window.ttq!.page?.(payload || {})
    } catch (e) {
      if (this._debug) console.warn("[TikTokPixel] page failed", e)
    }
  }

  /** Convenience helpers for common events */
  trackViewContent(payload?: Record<string, any>): void {
    this.track("ViewContent", payload)
  }
  trackInitiateCheckout(payload?: Record<string, any>): void {
    this.track("InitiateCheckout", payload)
  }
  trackCompleteRegistration(payload?: Record<string, any>): void {
    this.track("CompleteRegistration", payload)
  }
  /** Purchase event (recommended for completed orders) */
  trackPurchase(payload: { value: number; currency: string } & Record<string, any>): void {
    this.track("Purchase", payload)
  }
  /** Back-compat alias sometimes seen in older guides */
  trackCompletePayment(payload: { value: number; currency: string } & Record<string, any>): void {
    this.track("Purchase", payload)
  }

  // Additional standard event helpers (available if needed)
  trackAddPaymentInfo(payload?: Record<string, any>): void {
    this.track("AddPaymentInfo", payload)
  }
  trackAddToCart(payload?: Record<string, any>): void {
    this.track("AddToCart", payload)
  }
  trackAddToWishlist(payload?: Record<string, any>): void {
    this.track("AddToWishlist", payload)
  }
  trackContact(payload?: Record<string, any>): void {
    this.track("Contact", payload)
  }
  trackCustomizeProduct(payload?: Record<string, any>): void {
    this.track("CustomizeProduct", payload)
  }
  trackDownload(payload?: Record<string, any>): void {
    this.track("Download", payload)
  }
  trackFindLocation(payload?: Record<string, any>): void {
    this.track("FindLocation", payload)
  }
  trackLead(payload?: Record<string, any>): void {
    this.track("Lead", payload)
  }
  trackSchedule(payload?: Record<string, any>): void {
    this.track("Schedule", payload)
  }
  trackSearch(payload?: Record<string, any>): void {
    this.track("Search", payload)
  }
  trackStartTrial(payload?: Record<string, any>): void {
    this.track("StartTrial", payload)
  }
  trackSubmitApplication(payload?: Record<string, any>): void {
    this.track("SubmitApplication", payload)
  }
  trackSubscribe(payload?: Record<string, any>): void {
    this.track("Subscribe", payload)
  }
  trackApplicationApproval(payload?: Record<string, any>): void {
    this.track("ApplicationApproval", payload)
  }

  /** Associate user data (if available) */
  identify(payload: Record<string, any>): void {
    if (!this.canTrack()) return
    try {
      window.ttq!.identify?.(payload)
      if (this._debug) console.info("[TikTokPixel] identify", payload)
    } catch (e) {
      if (this._debug) console.warn("[TikTokPixel] identify failed", e)
    }
  }

  /** Run callback when ttq is ready (best-effort) */
  onReady(cb: () => void): void {
    if (!this.isBrowser()) return
    const t = window.ttq
    if (t?.ready && typeof t.ready === "function") {
      try {
        t.ready(cb)
        return
      } catch {}
    }
    if (this.canTrack()) cb()
  }

  private canTrack(): boolean {
    if (!this.isBrowser()) return false
    if (window.ttq && typeof window.ttq === "function") {
      if (!this._initialized) this._initialized = true
      return true
    }
    if (this._debug) console.warn("[TikTokPixel] not initialized or ttq missing; ignoring track call")
    return false
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined"
  }

  /**
   * Normalize common payload differences to match TikTok's parameter names:
   * - contents[].id -> contents[].content_id
   * - contents[].item_price -> contents[].price
   * - search_string -> query (keep both to be safe)
   */
  private normalizePayload(payload?: Record<string, any>): Record<string, any> | undefined {
    if (!payload) return payload
    try {
      const out: Record<string, any> = { ...payload }

      // Normalize search string param naming
      if (out.search_string && !out.query) out.query = out.search_string

      // Normalize contents array objects
      if (Array.isArray(out.contents)) {
        out.contents = out.contents.map((item: any) => {
          if (!item || typeof item !== "object") return item
          const mapped: Record<string, any> = { ...item }
          if (mapped.id != null && mapped.content_id == null) mapped.content_id = mapped.id
          if (mapped.item_price != null && mapped.price == null) mapped.price = mapped.item_price
          if (mapped.title != null && mapped.content_name == null) mapped.content_name = mapped.title
          if (mapped.name != null && mapped.content_name == null) mapped.content_name = mapped.name
          return mapped
        })
      }
      return out
    } catch {
      return payload
    }
  }
}

export const tiktokPixel = new TikTokPixel()
