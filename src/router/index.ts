import { route } from "quasar/wrappers"
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from "vue-router"

import routes from "./routes"

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

export default Router
