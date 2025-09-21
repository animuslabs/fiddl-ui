/**
 * Meta Pixel utility
 *
 * Usage:
 *   import { metaPixel } from 'src/lib/metaPixel'
 *   metaPixel.init('YOUR_PIXEL_ID', { debug: import.meta.env.DEV })
 *   metaPixel.track('ViewContent', { content_ids: ['SKU123'], content_type: 'product' })
 *   metaPixel.trackPurchase({ value: 49.99, currency: 'USD', contents: [{ id: 'SKU123', quantity: 1 }] })
 *
 * Notes:
 * - Safe in SSR: no-ops when window/document are unavailable
 * - Strongly typed params for major standard events
 * - Supports advanced matching and event_id (deduplication)
 */

declare global {
  interface Window {
    fbq?: FbqFunction
    _fbq?: FbqFunction
  }
}

type FbqFunction = {
  (...args: any[]): void
  callMethod?: (...args: any[]) => void
  queue: any[]
  loaded: boolean
  version: string
}

export type ContentType = "product" | "product_group"

/**
 * Standard "contents" entry used by commerce events
 */
export interface Content {
  id: string | number
  quantity: number
  item_price?: number
}

/**
 * Advanced matching keys (Meta can hash if not already hashed)
 * Prefer providing SHA-256 hashed values when possible.
 */
export interface AdvancedMatching {
  em?: string
  ph?: string
  fn?: string
  ln?: string
  ge?: string
  db?: string
  ct?: string
  st?: string
  zp?: string
  country?: string
  external_id?: string
}

/**
 * Common optional parameters that many events accept
 * Includes event_id used for deduplication with server-side events
 */
export interface BaseParams {
  content_category?: string
  content_ids?: Array<string | number>
  content_name?: string
  content_type?: ContentType
  contents?: Content[]
  currency?: string
  num_items?: number
  predicted_ltv?: number
  search_string?: string
  status?: boolean
  value?: number
  event_id?: string
}

/** Event-specific params (aligned to Meta standard events) */

/** AddPaymentInfo: optional content and value fields */
export type AddPaymentInfoParams = Pick<
  BaseParams,
  "content_ids" | "contents" | "currency" | "value" | "content_type" | "event_id"
> & Partial<BaseParams>

/** AddToCart: contents optional (required for Advantage+ catalog ads) */
export type AddToCartParams = Pick<
  BaseParams,
  "content_ids" | "content_type" | "contents" | "currency" | "value" | "event_id"
> & Partial<BaseParams>

/** AddToWishlist: optional content and value fields */
export type AddToWishlistParams = Pick<
  BaseParams,
  "content_ids" | "contents" | "currency" | "value" | "content_type" | "event_id"
> & Partial<BaseParams>

/** CompleteRegistration: optional currency/value/status */
export type CompleteRegistrationParams = Pick<
  BaseParams,
  "currency" | "value" | "status" | "event_id"
> & Partial<BaseParams>

/** Contact: no required fields */
export type ContactParams = BaseParams

/** CustomizeProduct: no required fields */
export type CustomizeProductParams = BaseParams

/** Donate: no required fields */
export type DonateParams = BaseParams

/** FindLocation: no required fields */
export type FindLocationParams = BaseParams

/** InitiateCheckout: optional content_ids, contents, currency, num_items, value */
export type InitiateCheckoutParams = Pick<
  BaseParams,
  "content_ids" | "contents" | "currency" | "num_items" | "value" | "content_type" | "event_id"
> & Partial<BaseParams>

/** Lead: optional currency/value */
export type LeadParams = Pick<BaseParams, "currency" | "value" | "event_id"> & Partial<BaseParams>

/** Purchase: requires currency and value */
export interface PurchaseParams extends Omit<BaseParams, "currency" | "value"> {
  currency: string
  value: number
}

/** Schedule: no required fields */
export type ScheduleParams = BaseParams

/** Search: includes optional content params + search_string */
export type SearchParams = Pick<
  BaseParams,
  "content_ids" | "content_type" | "contents" | "currency" | "search_string" | "value" | "event_id"
> & Partial<BaseParams>

/** StartTrial: optional currency/predicted_ltv/value */
export type StartTrialParams = Pick<
  BaseParams,
  "currency" | "predicted_ltv" | "value" | "event_id"
> & Partial<BaseParams>

/** SubmitApplication: no required fields */
export type SubmitApplicationParams = BaseParams

/** Subscribe: optional currency/predicted_ltv/value */
export type SubscribeParams = Pick<
  BaseParams,
  "currency" | "predicted_ltv" | "value" | "event_id"
> & Partial<BaseParams>

/** ViewContent: optional content and value fields */
export type ViewContentParams = Pick<
  BaseParams,
  "content_ids" | "content_type" | "contents" | "currency" | "value" | "event_id"
> & Partial<BaseParams>

/** Event payload map for strong typing of track() */
export interface EventPayloadMap {
  AddPaymentInfo: AddPaymentInfoParams
  AddToCart: AddToCartParams
  AddToWishlist: AddToWishlistParams
  CompleteRegistration: CompleteRegistrationParams
  Contact: ContactParams
  CustomizeProduct: CustomizeProductParams
  Donate: DonateParams
  FindLocation: FindLocationParams
  InitiateCheckout: InitiateCheckoutParams
  Lead: LeadParams
  Purchase: PurchaseParams
  Schedule: ScheduleParams
  Search: SearchParams
  StartTrial: StartTrialParams
  SubmitApplication: SubmitApplicationParams
  Subscribe: SubscribeParams
  ViewContent: ViewContentParams
}

/** Union of allowed standard event names */
export type StandardEvent = keyof EventPayloadMap

/** Promoted Object custom_event_type mapping reference */
export const PromotedObjectEventType: Record<StandardEvent, string> = {
  AddPaymentInfo: "ADD_PAYMENT_INFO",
  AddToCart: "ADD_TO_CART",
  AddToWishlist: "ADD_TO_WISHLIST",
  CompleteRegistration: "COMPLETE_REGISTRATION",
  Contact: "CONTACT",
  CustomizeProduct: "CUSTOMIZE_PRODUCT",
  Donate: "DONATE",
  FindLocation: "FIND_LOCATION",
  InitiateCheckout: "INITIATE_CHECKOUT",
  Lead: "LEAD",
  Purchase: "PURCHASE",
  Schedule: "SCHEDULE",
  Search: "SEARCH",
  StartTrial: "START_TRIAL",
  SubmitApplication: "SUBMIT_APPLICATION",
  Subscribe: "SUBSCRIBE",
  ViewContent: "VIEW_CONTENT"
}

export interface MetaPixelInitOptions {
  /** Enable console logging of pixel activity for debugging */
  debug?: boolean
  /** Advanced matching data (email/phone/etc.). Can be updated later via setAdvancedMatching() */
  advancedMatching?: AdvancedMatching
  /** Locale for the pixel script, default en_US */
  locale?: string
  /** If true, skip injecting script (assumes present already) */
  skipScriptInject?: boolean
}

/**
 * Meta Pixel utility
 * - Call init() once with your pixel ID
 * - Use track() or helper methods to send signals
 * - Safe no-ops on server
 */
export class MetaPixel {
  private _pixelId: string | null = null
  private _initialized = false
  private _debug = false

  /**
   * Initialize Meta Pixel and inject the script on client
   */
  init(pixelId: string, options: MetaPixelInitOptions = {}): void {
    if (!this.isBrowser()) return

    if (this._initialized && this._pixelId === pixelId) {
      if (options.advancedMatching && window.fbq) {
        window.fbq("init", pixelId, options.advancedMatching)
      }
      return
    }

    this._pixelId = pixelId
    this._debug = !!options.debug

    if (!options.skipScriptInject) {
      this.injectScript(options.locale || "en_US")
    }

    this.ensureFbq()

    if (window.fbq) {
      if (options.advancedMatching) {
        window.fbq("init", pixelId, options.advancedMatching)
      } else {
        window.fbq("init", pixelId)
      }
      this._initialized = true
      if (this._debug) console.info("[MetaPixel] initialized", { pixelId })
    }
  }

  /**
   * Update advanced matching fields after initialization
   */
  setAdvancedMatching(am: AdvancedMatching): void {
    if (!this.isBrowser()) return
    const fbq = window.fbq
    if (!fbq) return
    let pid = this._pixelId
    if (!pid) {
      try {
        pid = (import.meta as any).env?.VITE_META_PIXEL_ID || (import.meta as any).env?.METAPIXEL_ID || null
      } catch {
        pid = null as any
      }
    }
    if (pid) {
      fbq("init", pid as any, am)
      this._pixelId = String(pid)
      this._initialized = true
      if (this._debug) console.info("[MetaPixel] advanced matching set", am)
    } else {
      if (this._debug) console.info("[MetaPixel] advanced matching skipped; missing pixel id")
    }
  }

  /**
   * Track a standard event with typed params
   */
  track<E extends StandardEvent>(event: E, params?: EventPayloadMap[E]): void {
    if (!this.canTrack()) return
    const payload = (params || {}) as BaseParams
    const { event_id, ...rest } = payload
    if (this._debug) console.info("[MetaPixel] track", event, { ...rest, event_id })
    const fbq = window.fbq
    if (!fbq) return
    if (event_id) {
      fbq("track", event, rest, { eventID: event_id })
    } else {
      fbq("track", event, rest)
    }
  }

  /**
   * Track a custom event
   */
  trackCustom<T extends Record<string, any>>(name: string, payload?: T & { event_id?: string }): void {
    if (!this.canTrack()) return
    const { event_id, ...rest } = (payload || {}) as { event_id?: string }
    if (this._debug) console.info("[MetaPixel] trackCustom", name, { ...rest, event_id })
    const fbq = window.fbq
    if (!fbq) return
    if (event_id) {
      fbq("trackCustom", name, rest, { eventID: event_id })
    } else {
      fbq("trackCustom", name, rest)
    }
  }

  /** Convenience helpers */
  trackAddPaymentInfo(params?: AddPaymentInfoParams): void {
    this.track("AddPaymentInfo", params)
  }
  trackAddToCart(params?: AddToCartParams): void {
    this.track("AddToCart", params)
  }
  trackAddToWishlist(params?: AddToWishlistParams): void {
    this.track("AddToWishlist", params)
  }
  trackCompleteRegistration(params?: CompleteRegistrationParams): void {
    this.track("CompleteRegistration", params)
  }
  trackContact(params?: ContactParams): void {
    this.track("Contact", params)
  }
  trackCustomizeProduct(params?: CustomizeProductParams): void {
    this.track("CustomizeProduct", params)
  }
  trackDonate(params?: DonateParams): void {
    this.track("Donate", params)
  }
  trackFindLocation(params?: FindLocationParams): void {
    this.track("FindLocation", params)
  }
  trackInitiateCheckout(params?: InitiateCheckoutParams): void {
    this.track("InitiateCheckout", params)
  }
  trackLead(params?: LeadParams): void {
    this.track("Lead", params)
  }
  trackPurchase(params: PurchaseParams): void {
    this.track("Purchase", params)
  }
  trackSchedule(params?: ScheduleParams): void {
    this.track("Schedule", params)
  }
  trackSearch(params?: SearchParams): void {
    this.track("Search", params)
  }
  trackStartTrial(params?: StartTrialParams): void {
    this.track("StartTrial", params)
  }
  trackSubmitApplication(params?: SubmitApplicationParams): void {
    this.track("SubmitApplication", params)
  }
  trackSubscribe(params?: SubscribeParams): void {
    this.track("Subscribe", params)
  }
  trackViewContent(params?: ViewContentParams): void {
    this.track("ViewContent", params)
  }

  /** Core event commonly fired on each route change */
  trackPageView(): void {
    if (!this.canTrack()) return
    const fbq = window.fbq
    if (fbq) fbq("track", "PageView")
  }

  /** True if running in browser and pixel is initialized or global fbq exists */
  private canTrack(): boolean {
    if (!this.isBrowser()) return false
    if (window.fbq) {
      if (!this._initialized) {
        this._initialized = true
        try {
          const pid = (import.meta as any).env?.VITE_META_PIXEL_ID || (import.meta as any).env?.METAPIXEL_ID
          if (pid) this._pixelId = String(pid)
        } catch {}
      }
      return true
    }
    if (!this._initialized || !this._pixelId) {
      if (this._debug) console.warn("[MetaPixel] not initialized; ignoring track call")
      return false
    }
    return true
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined"
  }

  /**
   * Ensure a stub fbq exists so calls queue until the script loads
   */
  private ensureFbq(): void {
    if (!this.isBrowser()) return
    if (window.fbq) return
    const n: FbqFunction = function (...args: any[]) {
      if (n.callMethod) {
        n.callMethod.call(n, ...args)
      } else {
        n.queue.push(args)
      }
    } as unknown as FbqFunction
    n.queue = []
    n.loaded = true
    n.version = "2.0"
    window.fbq = n
    window._fbq = n
  }

  /**
   * Inject the Meta Pixel script if not already present
   */
  private injectScript(locale: string): void {
    if (!this.isBrowser()) return
    const existingByAttr = document.querySelector('script[data-mp="fbevents"]') as HTMLScriptElement | null
    const existingBySrc = document.querySelector(`script[src^="https://connect.facebook.net/"]`) as HTMLScriptElement | null
    if (existingByAttr || existingBySrc) return
    const s = document.createElement("script")
    s.async = true
    s.defer = true
    s.src = `https://connect.facebook.net/${encodeURIComponent(locale)}/fbevents.js`
    s.setAttribute("data-mp", "fbevents")
    const first = document.getElementsByTagName("script")[0]
    first?.parentNode?.insertBefore(s, first)
  }
}

export const metaPixel = new MetaPixel()
