type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

declare global {
  interface Window {
    dataLayer?: Array<Record<string, any>>
  }
}

class GoogleTagManager {
  private _debug = false

  init(options: { debug?: boolean } = {}): void {
    this._debug = !!options.debug
    if (typeof window === "undefined") return
    if (!window.dataLayer) window.dataLayer = []
  }

  private push(obj: Record<string, any>): void {
    if (typeof window === "undefined") return
    try {
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push(obj)
      if (this._debug) console.info("[GTM] push", obj)
    } catch (e) {
      if (this._debug) console.warn("[GTM] push failed", e)
    }
  }

  /** Generic GA4-style event */
  track(event: string, params?: Record<string, Json>): void {
    this.push({ event, ...(params || {}) })
  }

  pageView(params?: Record<string, Json>): void {
    const p = params || {}
    const page_location = typeof window !== "undefined" ? window.location.href : undefined
    const page_title = typeof document !== "undefined" ? document.title : undefined
    const page_path = typeof window !== "undefined" ? window.location.pathname : undefined
    this.push({ event: "page_view", page_location, page_title, page_path, ...p })
  }
}

export const gtm = new GoogleTagManager()

