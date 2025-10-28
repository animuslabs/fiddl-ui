import { route } from "quasar/wrappers"
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from "vue-router"

import routes from "./routes"
import { setupRoutePrefetch } from "src/lib/routePreloader"
import { events } from "lib/eventsManager"

// const createHistory = import.meta.env.SERVER ? createMemoryHistory : import.meta.env.VUE_ROUTER_MODE === "history" ? createWebHistory : createWebHashHistory
const createHistory = () => createWebHistory(import.meta.env.VUE_ROUTER_BASE || "/")
console.log("history mode:", import.meta.env)
const Router = createRouter({
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      console.log("scrollBehavior: savedPosition", savedPosition)
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
  routes,
  // history: createHistory(import.meta.env.VUE_ROUTER_BASE),
  history: createHistory(),
})

// Track the most recent navigation target so we can reload to it on chunk failures
let __pendingNavPath: string | null = null
Router.beforeEach((to) => {
  // Use SSR flag: client when not SSR
  if (!import.meta.env.SSR) {
    __pendingNavPath = to.fullPath
  }
  return true
})

function isStaleChunkError(err: unknown): boolean {
  try {
    const anyErr = err as any
    const name = String(anyErr?.name || "")
    const msg = String(anyErr?.message || anyErr || "")
    // Common signals across Vite/Webpack when a dynamic import for a route fails after deploy
    return (
      /ChunkLoadError/i.test(name) ||
      /Loading( CSS)? chunk \d+ failed/i.test(msg) ||
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg)
    )
  } catch {
    return false
  }
}

function forceReloadToTarget(routerTargetFallback?: string) {
  // Only act on client; in Vite, use !SSR instead of CLIENT
  if (import.meta.env.SSR) return
  const current = window.location.pathname + window.location.search + window.location.hash
  const target = __pendingNavPath || routerTargetFallback || current
  // Simple loop guard: only auto-reload once per 10s
  const KEY = "app:stale-chunk-reload-ts"
  const now = Date.now()
  const last = Number(sessionStorage.getItem(KEY) || 0)
  if (now - last < 10_000) return
  sessionStorage.setItem(KEY, String(now))
  try {
    window.location.replace(target)
  } catch {
    window.location.href = target
  }
}

// Recover from route component chunk failures by forcing a hard reload to the intended path
Router.onError((err) => {
  if (isStaleChunkError(err)) {
    // Prefer the tracked target; fall back to router's currentRoute if available
    const fallback = (Router as any)?.currentRoute?.value?.fullPath || undefined
    forceReloadToTarget(fallback)
    return
  }
  // Non-chunk errors: log for visibility
  console.error("[router] navigation error", err)
})
Router.afterEach((to) => {
  if (!import.meta.env.SSR) {
    const canonicalLink = document.getElementById("canonical-link")
    const baseUrl = window.location.origin
    if (canonicalLink) canonicalLink.setAttribute("href", `${baseUrl}${to.path}`)
  }
})

// Track page views on SPA navigations (skip initial load)
let hasTrackedInitialPageView = false
Router.afterEach((to) => {
  if (!import.meta.env.SSR) {
    // Always emit section opens for key areas
    const name = (to?.name as string) || ""
    switch (name) {
      case "magicMirror":
        try { events.sectionOpen("magic_mirror") } catch {}
        break
      case "magicMirrorBanana":
        try { events.sectionOpen("magic_mirror_fast") } catch {}
        break
      case "claim":
        try { events.sectionOpen("claim") } catch {}
        break
      case "missions":
        try { events.sectionOpen("missions") } catch {}
        break
    }

    // Fan out SPA page view (skip on very first load to avoid double-counting)
    if (hasTrackedInitialPageView) {
      events.pageView()
    } else {
      hasTrackedInitialPageView = true
    }
  }
})

// Preload other route chunks when idle after initial load
if (!import.meta.env.SSR) {
  const startRoutePrefetch = () => {
    setupRoutePrefetch(Router, {
      // Skip heavy/rare pages by default; adjust as needed
      excludeNames: ["magicMirror", "magicMirrorBanana"],
      concurrency: 2,
      delayMs: 0,
      runOnce: true,
    })
  }

  const scheduleRoutePrefetch = () => {
    window.setTimeout(startRoutePrefetch, 800)
  }

  if (document.readyState === "complete") scheduleRoutePrefetch()
  else window.addEventListener("load", scheduleRoutePrefetch, { once: true })

  // As a safety net, also watch for unhandled dynamic import rejections
  window.addEventListener("unhandledrejection", (ev) => {
    if (isStaleChunkError((ev as PromiseRejectionEvent).reason)) {
      const fallback = (Router as any)?.currentRoute?.value?.fullPath || undefined
      forceReloadToTarget(fallback)
    }
  })
  // And generic script import failures (some browsers surface these as window 'error')
  window.addEventListener(
    "error",
    (ev: Event) => {
      const anyEv = ev as any
      const err = anyEv?.error || anyEv?.message || ev
      if (isStaleChunkError(err)) {
        const fallback = (Router as any)?.currentRoute?.value?.fullPath || undefined
        forceReloadToTarget(fallback)
      }
    },
    true,
  )
}

export default Router
