import { boot } from "quasar/wrappers"
import { metaPixel } from "lib/metaPixel"
import { events } from "lib/eventsManager"
import { tiktokPixel } from "lib/tiktokPixel"
import { gtm } from "lib/googleTagManager"
import { jwt } from "lib/jwt"

type IdleCallback = () => void

const DEFAULT_TIKTOK_PIXEL_ID = "D3GVD8JC77UEJB9H9GFG"
const TIKTOK_PIXEL_URL = "https://analytics.tiktok.com/i18n/pixel/events.js"
const GTM_HOST = "https://www.googletagmanager.com/gtm.js"
const UMAMI_SRC = "https://umami.fiddl.animus.is/script.js"
const UMAMI_DATASET = "a6295092-8b12-42b8-ab4c-de684673248d"
const GTM_CONTAINER = "GTM-ND4R396L"

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function onIdle(cb: IdleCallback): void {
  if (!isBrowser()) return
  const w = window as Window & { requestIdleCallback?: (fn: IdleCallback, opts?: { timeout?: number }) => void }
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout: 2000 })
  } else {
    window.setTimeout(cb, 400)
  }
}

function initMetaPixel(debug: boolean): void {
  const pixelId = (import.meta as any)?.env?.VITE_META_PIXEL_ID as string | undefined
  if (!pixelId) return
  const saved = jwt.read()
  const advancedMatching: Record<string, string> = {}
  if (saved?.userId) advancedMatching.external_id = String(saved.userId)
  metaPixel.init(pixelId, {
    debug,
    advancedMatching: Object.keys(advancedMatching).length ? advancedMatching : undefined,
  })
}

function ensureTikTokStub(): any {
  if (!isBrowser()) return null
  const w = window as any
  const t = "ttq"
  w.TiktokAnalyticsObject = t
  const existing = w[t]
  if (existing && typeof existing.load === "function") return existing
  const ttq: any = []
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ]
  ttq.setAndDefer = function (obj: any, method: string) {
    obj[method] = function () {
      obj.push([method].concat(Array.prototype.slice.call(arguments, 0)))
    }
  }
  ttq._i = ttq._i || {}
  ttq._t = ttq._t || {}
  ttq._o = ttq._o || {}
  for (const method of ttq.methods) ttq.setAndDefer(ttq, method)
  ttq.instance = function (name: string) {
    const inst = ttq._i[name] || []
    for (const method of ttq.methods) ttq.setAndDefer(inst, method)
    return inst
  }
  ttq.loaded = true
  ttq.version = "1.0"
  ttq.load = function load(id: string, opts?: Record<string, unknown>) {
    if (!isBrowser()) return
    const scriptId = `ttq-script-${id}`
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!ttq._i[id]) ttq._i[id] = []
    ttq._i[id]._u = TIKTOK_PIXEL_URL
    ttq._t[id] = Date.now()
    ttq._o[id] = opts || {}
    if (existingScript) return
    const script = document.createElement("script")
    script.id = scriptId
    script.type = "text/javascript"
    script.async = true
    script.src = `${TIKTOK_PIXEL_URL}?sdkid=${encodeURIComponent(id)}&lib=${t}`
    const first = document.getElementsByTagName("script")[0]
    first?.parentNode?.insertBefore(script, first)
  }
  w[t] = ttq
  return ttq
}

function initTikTok(debug: boolean): void {
  const pixelId = ((import.meta as any)?.env?.VITE_TIKTOK_PIXEL_ID as string | undefined) || DEFAULT_TIKTOK_PIXEL_ID
  if (!pixelId) return
  const stub = ensureTikTokStub()
  if (!stub) return
  if (!stub._initializedIds) stub._initializedIds = new Set<string>()
  if (!stub._initializedIds.has(pixelId)) {
    stub._initializedIds.add(pixelId)
    stub.load(pixelId)
    stub.page()
  }
  tiktokPixel.init({ debug })
}

function initGtm(debug: boolean): void {
  if (!GTM_CONTAINER) return
  if (!isBrowser()) return
  const existing = document.querySelector<HTMLScriptElement>(`script[data-gtm="${GTM_CONTAINER}"]`)
  if (existing) return
  const w = window as any
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" })
  gtm.init({ debug })
  const script = document.createElement("script")
  script.async = true
  script.src = `${GTM_HOST}?id=${encodeURIComponent(GTM_CONTAINER)}`
  script.setAttribute("data-gtm", GTM_CONTAINER)
  document.head.appendChild(script)
}

function loadUmami(): void {
  if (!UMAMI_DATASET) return
  if (!isBrowser()) return
  const existing = document.querySelector<HTMLScriptElement>(`script[data-umami="${UMAMI_DATASET}"]`)
  if (existing) return
  const script = document.createElement("script")
  script.defer = true
  script.dataset.websiteId = UMAMI_DATASET
  script.src = UMAMI_SRC
  script.setAttribute("data-umami", UMAMI_DATASET)
  document.head.appendChild(script)
}

export default boot(() => {
  if (!isBrowser()) return
  const debug = !!(import.meta as any)?.env?.DEV
  onIdle(() => {
    initMetaPixel(debug)
    initTikTok(debug)
    initGtm(debug)
    loadUmami()
    try {
      events.pageView()
    } catch {}
  })
})
