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
    if (this._debug) console.info("[TikTokPixel] track", event, payload || {})
    try {
      window.ttq!.track?.(event, payload || {})
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
  /** Use TikTok's CompletePayment for purchases */
  trackCompletePayment(payload: { value: number; currency: string } & Record<string, any>): void {
    this.track("CompletePayment", payload)
  }
  /** Alias for parity with Meta helper naming */
  trackPurchase(payload: { value: number; currency: string } & Record<string, any>): void {
    this.trackCompletePayment(payload)
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
}

export const tiktokPixel = new TikTokPixel()

