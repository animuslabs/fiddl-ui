import { boot } from "quasar/wrappers"
import { jwt } from "src/lib/jwt"
import { useUserAuth } from "src/stores/userAuth"
import axios from "axios"

// Lazy import to avoid pulling analytics in non‑TMA sessions unnecessarily
let telegramAnalytics: any

function isTmaEnv(): boolean {
  try {
    if (typeof window === "undefined") return false
    const qp = new URLSearchParams(window.location.search)
    const forced = qp.has("tma") || qp.has("tgWebApp") || qp.get("mode") === "tma"
    // Real Telegram Mini App environment
    const hasWebApp = Boolean((window as any)?.Telegram?.WebApp)
    return hasWebApp || forced
  } catch {
    return false
  }
}

async function initAnalyticsIfPossible() {
  try {
    if (!isTmaEnv()) return
    // Avoid double init
    const w = window as any
    if (w.__tmaAnalyticsInit) return

    const token = (import.meta as any).env?.VITE_TMA_ANALYTICS_TOKEN
    const appName = (import.meta as any).env?.VITE_TMA_ANALYTICS_APP || "fiddl"
    if (!token) {
      console.warn("TMA analytics token missing (VITE_TMA_ANALYTICS_TOKEN)")
      return
    }

    if (!telegramAnalytics) {
      // dynamic import keeps bundle lean for non‑TMA sessions
      telegramAnalytics = (await import("@telegram-apps/analytics")).default
    }
    telegramAnalytics.init({ token, appName })
    w.__tmaAnalyticsInit = true
  } catch (e) {
    console.warn("Failed to init TMA analytics", e)
  }
}

function prepareTmaShell() {
  try {
    if (!isTmaEnv()) return
    const tg = (window as any)?.Telegram?.WebApp
    if (tg) {
      try { tg.ready?.() } catch {}
      try { tg.expand?.() } catch {}
      // Optional: adapt to Telegram theme
      try {
        const bg = tg.themeParams?.bg_color
        if (bg) document.documentElement.style.setProperty("--tma-bg", `#${bg}`)
      } catch {}
    }
    // Add a CSS flag for quick UI tweaks in Mini App mode
    document.documentElement.classList.add("tma-mode")
    ;(window as any).__TMA__ = { enabled: true }
  } catch {}
}

async function loginViaWebAppIfPossible() {
  try {
    if (!isTmaEnv()) return false
    // Already logged in or tried
    if (jwt.read()) return true
    if (sessionStorage.getItem("tmaWebAppLoginTried")) return false
    const tg = (window as any)?.Telegram?.WebApp
    const initData: string | undefined = tg?.initData
    if (!initData || initData.length < 16) return false

    // Build API base (avoid coupling with other boot order)
    let apiBase = (import.meta as any).env?.VITE_API_URL || "https://api.fiddl.art"
    if (!/^https?:\/\//i.test(apiBase)) {
      apiBase = (apiBase.startsWith("localhost") ? "http://" : "https://") + apiBase
    }
    const url = apiBase.replace(/\/$/, "") + "/api/telegram/webAppLogin"

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData,
        startParam: tg?.initDataUnsafe?.start_param || undefined,
      }),
      credentials: "omit",
    })
    sessionStorage.setItem("tmaWebAppLoginTried", "1")
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    const userId: string | undefined = data?.userId || data?.user_id || data?.uid
    const token: string | undefined = data?.token || data?.jwt
    if (!userId || !token) return false

    const auth = useUserAuth()
    await auth.applyServerSession(userId, token)
    return true
  } catch {
    return false
  }
}

export default boot(async ({ router }) => {
  if (typeof window === "undefined") return
  // Ensure axios baseURL is set early for any API calls triggered here
  try {
    let apiBase = (import.meta as any).env?.VITE_API_URL || "https://api.fiddl.art"
    if (!/^https?:\/\//i.test(apiBase)) {
      apiBase = (apiBase.startsWith("localhost") ? "http://" : "https://") + apiBase
    }
    const base = apiBase.replace(/\/$/, "") + "/api"
    if (!axios.defaults.baseURL) axios.defaults.baseURL = base
  } catch {}
  prepareTmaShell()
  await initAnalyticsIfPossible()

  // Bridge Telegram Mini App deep-start tokens to our existing /tg-login flow
  try {
    if (!isTmaEnv()) return
    // Skip if already logged in
    if (jwt.read()) return
    if (window.location.pathname.startsWith("/tg-login")) return
    // Prefer explicit JWT from start param or query
    if (!sessionStorage.getItem("tmaStartHandled")) {
      const qp = new URLSearchParams(window.location.search)
      const qpToken = qp.get("t") || qp.get("token") || null
      const sp: string | undefined = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param
      const candidate = (qpToken || sp || "").trim()
      let token: string | null = null
      if (candidate) {
        const maybe = candidate.startsWith("t=") ? candidate.slice(2) : candidate
        // Minimal JWT shape check (base64url.base64url.base64url)
        if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(maybe)) token = maybe
      }
      if (token) {
        sessionStorage.setItem("tmaStartHandled", "1")
        await router.replace({ path: "/tg-login", query: { t: token } })
        return
      }
    }

    // If no token present, attempt WebApp initData validator based login
    await loginViaWebAppIfPossible()
  } catch {}
})
