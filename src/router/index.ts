import { route } from "quasar/wrappers"
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from "vue-router"

import routes from "./routes"

// const createHistory = import.meta.env.SERVER ? createMemoryHistory : import.meta.env.VUE_ROUTER_MODE === "history" ? createWebHistory : createWebHashHistory
const createHistory = () => createWebHistory
console.log("history mode:", import.meta.env)
const Router = createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes,
  // history: createHistory(import.meta.env.VUE_ROUTER_BASE),
  history: createWebHistory(),
})
Router.afterEach((to) => {
  if (import.meta.env.CLIENT) {
    const canonicalLink = document.getElementById("canonical-link")
    const baseUrl = window.location.origin
    if (canonicalLink) canonicalLink.setAttribute("href", `${baseUrl}${to.path}`)
  }
})

export default Router
