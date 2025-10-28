const TELEGRAM_SDK_SRC = "https://telegram.org/js/telegram-web-app.js"

let sdkLoadPromise: Promise<void> | null = null

const FORCE_FLAGS = ["tma", "tgWebApp"]

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function readSearchParams(): URLSearchParams | null {
  if (!isBrowser()) return null
  try {
    return new URLSearchParams(window.location.search)
  } catch {
    return null
  }
}

function readHashParams(): URLSearchParams | null {
  if (!isBrowser()) return null
  try {
    const hash = window.location.hash.replace(/^#/, "")
    return new URLSearchParams(hash)
  } catch {
    return null
  }
}

function forcedByQuery(): boolean {
  const qp = readSearchParams()
  if (qp) {
    for (const flag of FORCE_FLAGS) {
      if (qp.has(flag)) return true
    }
    if (qp.get("mode") === "tma") return true
  }
  const hp = readHashParams()
  if (hp) {
    for (const flag of FORCE_FLAGS) {
      if (hp.has(flag)) return true
    }
  }
  return false
}

function isTelegramUserAgent(): boolean {
  if (!isBrowser()) return false
  const ua = navigator.userAgent || ""
  return /\bTelegram\b/i.test(ua) || /\bTMA\b/i.test(ua)
}

function isTelegramReferrer(): boolean {
  if (!isBrowser()) return false
  try {
    const ref = document.referrer || ""
    return /https?:\/\/(web\.)?telegram\.org/i.test(ref) || /https?:\/\/t\.me/i.test(ref)
  } catch {
    return false
  }
}

export function hasTelegramWebApp(): boolean {
  if (!isBrowser()) return false
  const tg = (window as any)?.Telegram
  return Boolean(tg?.WebApp)
}

export function isLikelyTmaSession(): boolean {
  if (!isBrowser()) return false
  if (hasTelegramWebApp()) return true
  if (forcedByQuery()) return true
  if (isTelegramUserAgent()) return true
  if (isTelegramReferrer()) return true
  return false
}

export function ensureTelegramSdkLoaded(options: { force?: boolean } = {}): Promise<void> {
  if (!isBrowser()) return Promise.resolve()

  const shouldLoad = options.force || isLikelyTmaSession()
  if (!shouldLoad) return Promise.resolve()

  if (hasTelegramWebApp()) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    try {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${TELEGRAM_SDK_SRC}"]`)
      if (existing) {
        if (existing.dataset.loaded === "1") {
          resolve()
          return
        }
        existing.addEventListener("load", () => resolve())
        existing.addEventListener("error", (evt) => reject(evt))
        return
      }
      const el = document.createElement("script")
      el.src = TELEGRAM_SDK_SRC
      el.async = true
      el.setAttribute("data-tma-sdk", "1")
      el.addEventListener("load", () => {
        el.dataset.loaded = "1"
        resolve()
      })
      el.addEventListener("error", (evt) => {
        sdkLoadPromise = null
        reject(evt)
      })
      document.head.appendChild(el)
    } catch (err) {
      sdkLoadPromise = null
      reject(err)
    }
  })

  return sdkLoadPromise
}

