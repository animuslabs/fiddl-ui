import { route } from "quasar/wrappers"
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from "vue-router"

import routes from "./routes"
import { setupRoutePrefetch } from "src/lib/routePreloader"

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
Router.afterEach((to) => {
  if (import.meta.env.CLIENT) {
    const canonicalLink = document.getElementById("canonical-link")
    const baseUrl = window.location.origin
    if (canonicalLink) canonicalLink.setAttribute("href", `${baseUrl}${to.path}`)
  }
})

// Track Meta Pixel page views on SPA navigations (skip initial load)
let hasTrackedInitialPageView = false
Router.afterEach(() => {
  if (import.meta.env.CLIENT) {
    if (hasTrackedInitialPageView) {
      const fbq = (window as any).fbq
      if (typeof fbq === "function") fbq("track", "PageView")
    } else {
      hasTrackedInitialPageView = true
    }
  }
})

// Preload other route chunks when idle after initial load
if (import.meta.env.CLIENT) {
  setupRoutePrefetch(Router, {
    // Skip heavy/rare pages by default; adjust as needed
    excludeNames: ["magicMirror", "magicMirrorBanana"],
    concurrency: 2,
    delayMs: 500,
    runOnce: true,
  })
}

export default Router
