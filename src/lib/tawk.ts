// src/lib/tawk.ts
declare global {
  interface Window {
    Tawk_API: any
  }
}

const TAWK_EMBED_URL = "https://embed.tawk.to/68943cd8b89c23192f895677/1j21grc1q"
let timeoutId: number

let loadPromise: Promise<void> | null = null

function isClientReady() {
  return typeof window !== "undefined" && !!window.Tawk_API
}

function isTmaMode() {
  try {
    if (typeof window === "undefined") return false
    // Prefer explicit flag from boot/tma
    if ((window as any)?.__TMA__?.enabled) return true
    // Do not rely on presence of Telegram.WebApp alone; it may exist outside Telegram.
    const qp = new URLSearchParams(window.location.search)
    return qp.has("tma") || qp.has("tgWebApp") || qp.get("mode") === "tma"
  } catch {
    return false
  }
}

function injectScript(timeoutMs = 15000): Promise<void> {
  // Do not load Tawk inside Telegram Mini App
  if (isTmaMode()) return Promise.resolve()
  if (isClientReady()) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TAWK_EMBED_URL}"]`) as HTMLScriptElement | null

    function done(ok: boolean) {
      window.clearTimeout(timeoutId)
      if (!ok) {
        loadPromise = null
        reject(new Error("Tawk failed to load"))
      } else {
        resolve()
      }
    }

    window.Tawk_API = window.Tawk_API || {}
    const prevOnLoad = window.Tawk_API.onLoad
    window.Tawk_API.onLoad = () => {
      try {
        prevOnLoad?.()
      } finally {
        done(true)
      }
    }

    if (!existing) {
      const s = document.createElement("script")
      s.src = TAWK_EMBED_URL
      s.async = true
      s.charset = "UTF-8"
      s.setAttribute("crossorigin", "*")
      s.onerror = () => done(false)
      document.head.appendChild(s)
    }

    timeoutId = window.setTimeout(() => done(false), timeoutMs)
  })

  return loadPromise
}

export const tawk = {
  get client() {
    return window.Tawk_API || undefined
  },

  init(timeoutMs?: number) {
    return injectScript(timeoutMs)
  },

  whenReady(timeoutMs?: number) {
    return injectScript(timeoutMs)
  },

  start() {
    this.client?.start?.()
  },
  shutdown() {
    this.client?.shutdown?.()
  },
  showWidget() {
    this.client?.showWidget?.()
  },
  hideWidget() {
    this.client?.hideWidget?.()
  },
  toggleVisibility() {
    this.client?.toggleVisibility?.()
  },

  onStatusChange(cb: (status: string) => void) {
    if (!isClientReady()) return
    this.client.onStatusChange = cb
  },
  onLoad(cb: () => void) {
    if (!isClientReady()) return
    this.client.onLoad = cb
  },
  onChatStarted(cb: () => void) {
    if (!isClientReady()) return
    this.client.onChatStarted = cb
  },
  onChatEnded(cb: () => void) {
    if (!isClientReady()) return
    this.client.onChatEnded = cb
  },

  setAttributes(attributes: Record<string, any>, callback?: (err?: unknown) => void) {
    if (!isClientReady()) return
    this.client.setAttributes?.(attributes, callback ?? (() => {}))
  },

  unloadScript() {
    const script = document.querySelector(`script[src="${TAWK_EMBED_URL}"]`)
    if (script) script.remove()

    try {
      delete (window as any).Tawk_API
    } catch {
      ;(window as any).Tawk_API = undefined
    }

    document.cookie.split(";").forEach((cookie) => {
      const [rawName] = cookie.split("=")
      const name = rawName?.trim()
      if (name && (name.startsWith("twk_") || name.includes("Tawk"))) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      }
    })

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("twk_") || key.includes("Tawk")) {
        localStorage.removeItem(key)
      }
    }

    loadPromise = null
  },

  reloadScript(timeoutMs?: number) {
    this.unloadScript()
    return injectScript(timeoutMs)
  },

  async setVisitorInfo(name: string, email: string, extraAttributes?: Record<string, any>) {
    if (isTmaMode()) return
    this.unloadScript()
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_API.visitor = { name, email }
    if (extraAttributes) {
      window.Tawk_API.attributes = { ...(window.Tawk_API.attributes || {}), ...extraAttributes }
    }
    await this.reloadScript()
  },
}
