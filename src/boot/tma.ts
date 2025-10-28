import { boot } from "quasar/wrappers"
import { jwt } from "src/lib/jwt"
import { useUserAuth } from "src/stores/userAuth"
import axios from "axios"
import { ensureTelegramSdkLoaded, hasTelegramWebApp, isLikelyTmaSession } from "src/lib/telegramEnv"
import { ensureTelemetreeInitialized } from "src/lib/telemetreeBridge"

// Lazy import to avoid pulling analytics in non‑TMA sessions unnecessarily
let telegramAnalytics: any

// Debug helpers
function isDebugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false
    const qp = new URLSearchParams(window.location.search)
    if (qp.has("tma-debug") || qp.get("debug") === "tma") return true
    const ls = window.localStorage?.getItem("TMA_DEBUG")
    if (ls === "1" || ls === "true") return true
    const env = (import.meta as any).env?.VITE_TMA_DEBUG
    return env === "1" || env === "true"
  } catch {
    return false
  }
}

const D = {
  log: (...a: any[]) => {
    if (!isDebugEnabled()) return
    try {
       
      console.log("[TMA]", ...a)
    } catch {}
  },
  warn: (...a: any[]) => {
    if (!isDebugEnabled()) return
    try {
       
      console.warn("[TMA]", ...a)
    } catch {}
  },
}

function isTmaEnv(): boolean {
  try {
    if (typeof window === "undefined") return false
    const tg = (window as any)?.Telegram?.WebApp
    const hasInitData = typeof tg?.initData === "string" && tg.initData.length > 0
    const result = Boolean(hasInitData || isLikelyTmaSession())
    D.log("Env check", { hasInitData, likely: isLikelyTmaSession(), hasTelegramWebApp: hasTelegramWebApp(), result })
    return result
  } catch {
    return false
  }
}

async function ensureTelegramContext(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (hasTelegramWebApp()) return true
  try {
    await ensureTelegramSdkLoaded({ force: true })
  } catch (err) {
    D.warn("Failed to load Telegram SDK", err)
    return false
  }
  // Give Telegram a beat to populate WebApp interface
  for (let i = 0; i < 10; i++) {
    if (hasTelegramWebApp()) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return hasTelegramWebApp()
}

async function initAnalyticsIfPossible() {
  try {
    if (!isTmaEnv()) return
    const contextReady = await ensureTelegramContext()
    if (!contextReady) {
      D.warn("Skip analytics init: Telegram context unavailable")
      return
    }
    // Avoid double init
    const w = window as any
    if (w.__tmaAnalyticsInit) return

    const token = (import.meta as any).env?.VITE_TMA_ANALYTICS_TOKEN
    const appName = (import.meta as any).env?.VITE_TMA_ANALYTICS_APP || "fiddl"
    if (!token) {
      D.warn("Analytics token missing (VITE_TMA_ANALYTICS_TOKEN)")
      return
    }

    if (!telegramAnalytics) {
      // dynamic import keeps bundle lean for non‑TMA sessions
      telegramAnalytics = (await import("@telegram-apps/analytics")).default
    }
    D.log("Init analytics", { appName })
    telegramAnalytics.init({ token, appName })
    w.__tmaAnalyticsInit = true
  } catch (e) {
    D.warn("Failed to init TMA analytics", e)
  }
}

async function prepareTmaShell() {
  try {
    if (!isTmaEnv()) return
    const contextReady = await ensureTelegramContext()
    if (!contextReady) {
      D.warn("TMA shell skipped: Telegram SDK unavailable")
      return
    }
    const tg = (window as any)?.Telegram?.WebApp
    if (tg) {
      D.log("WebApp present", {
        version: tg.version,
        platform: tg.platform,
        colorScheme: tg.colorScheme,
        themeParams: tg.themeParams,
      })
      try { tg.ready?.() } catch {}
      try { tg.expand?.() } catch {}
      // Keep a CSS custom property updated with the Telegram visible viewport height
      try {
        const applyHeightVar = () => {
          const h = (tg as any)?.viewportStableHeight || (tg as any)?.viewportHeight
          if (typeof h === "number" && h > 0) {
            document.documentElement.style.setProperty("--tg-viewport-height", `${Math.round(h)}px`)
          }
        }
        applyHeightVar()
        tg.onEvent?.("viewportChanged", applyHeightVar)
      } catch {}
      // Optional: adapt to Telegram theme
      try {
        const bg = tg.themeParams?.bg_color
        if (bg) document.documentElement.style.setProperty("--tma-bg", `#${bg}`)
      } catch {}
    } else {
      D.warn("Telegram.WebApp not found. If testing in Telegram, ensure SDK loaded.")
    }
    // Add a CSS flag for quick UI tweaks in Mini App mode
    document.documentElement.classList.add("tma-mode")
    ;(window as any).__TMA__ = { enabled: true }
    ;(window as any).__TMA_DEBUG__ = { enabled: isDebugEnabled() }
    void ensureTelemetreeInitialized().catch(() => {})
  } catch {}
}

async function loginViaWebAppIfPossible() {
  try {
    if (!isTmaEnv()) {
      D.log("Skip WebApp login: not in TMA env")
      return false
    }
    const contextReady = await ensureTelegramContext()
    if (!contextReady) {
      D.warn("Skip WebApp login: Telegram context unavailable")
      return false
    }
    // Small retry to give Telegram time to inject interface on some platforms
    let tries = 0
    while (!(window as any)?.Telegram?.WebApp && tries < 20) {
      await new Promise((r) => setTimeout(r, 100))
      tries++
    }
    if (!(window as any)?.Telegram?.WebApp) {
      D.warn("Telegram.WebApp still undefined after wait")
    }
    // Already logged in
    if (jwt.read()) {
      D.log("Skip WebApp login: JWT already present")
      return true
    }
    // Only skip if we already succeeded this session
    if (sessionStorage.getItem("tmaWebAppLoginDone")) {
      D.log("Skip WebApp login: already completed this session")
      return true
    }
    // Give Telegram a brief moment to populate initData on slower clients
    await new Promise((r) => setTimeout(r, 60))
    const tg = (window as any)?.Telegram?.WebApp
    const initData: string | undefined = tg?.initData
    if (!initData || initData.length < 16) {
      D.warn("WebApp.initData missing or too short", { hasTg: !!tg, initDataLen: initData?.length || 0 })
      return false
    }
    D.log("Have initData", { len: initData.length, platform: tg?.platform, version: tg?.version })

    // Build API base (avoid coupling with other boot order)
    let apiBase = (import.meta as any).env?.VITE_API_URL || "https://api.fiddl.art"
    if (!/^https?:\/\//i.test(apiBase)) {
      apiBase = (apiBase.startsWith("localhost") ? "http://" : "https://") + apiBase
    }
    const url = apiBase.replace(/\/$/, "") + "/api/telegram/webAppLogin"
    D.log("POST webAppLogin", { url, base: apiBase })

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData,
        startParam: tg?.initDataUnsafe?.start_param || undefined,
        initDataUnsafe: tg?.initDataUnsafe || undefined,
        platform: tg?.platform || undefined,
        version: tg?.version || undefined,
      }),
      credentials: "omit",
    })
    if (!res.ok) {
      D.warn("webAppLogin failed", { status: res.status, statusText: res.statusText })
      return false
    }
    const data = await res.json().catch(() => null)
    D.log("webAppLogin response", {
      keys: data ? Object.keys(data) : null,
    })
    const userId: string | undefined = data?.userId || data?.user_id || data?.uid
    const token: string | undefined = data?.token || data?.jwt
    if (!userId || !token) {
      D.warn("webAppLogin missing fields", { userId: !!userId, token: !!token })
      return false
    }

    const auth = useUserAuth()
    await auth.applyServerSession(userId, token)
    sessionStorage.setItem("tmaWebAppLoginDone", "1")
    D.log("Applied server session via webAppLogin", { userId })
    return true
  } catch (e) {
    D.warn("Exception during webAppLogin", e)
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
  await prepareTmaShell()
  await initAnalyticsIfPossible()
  // In TMA mode, ensure no prior login is restored or kept around
  try {
    if (isTmaEnv()) {
      jwt.remove()
    }
  } catch {}

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
      D.log("Deep-start token probe", {
        hasQueryToken: !!qpToken,
        hasStartParam: !!sp,
        tokenDetected: !!token,
      })
      if (token) {
        sessionStorage.setItem("tmaStartHandled", "1")
        await router.replace({ path: "/tg-login", query: { t: token } })
        return
      }
    }

    // If no token present, attempt WebApp initData validator based login
    const ok = await loginViaWebAppIfPossible()
    if (!ok) D.warn("WebApp initData login did not complete")
  } catch {}
})
