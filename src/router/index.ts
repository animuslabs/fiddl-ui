import { route } from "quasar/wrappers"
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from "vue-router"

import routes from "./routes"

const createHistory = process.env.SERVER ? createMemoryHistory : process.env.VUE_ROUTER_MODE === "history" ? createWebHistory : createWebHashHistory

const Router = createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes,

  // Leave this as is and make changes in quasar.conf.js instead!
  // quasar.conf.js -> build -> vueRouterMode
  // quasar.conf.js -> build -> publicPath
  history: createHistory(process.env.VUE_ROUTER_BASE),
})
Router.afterEach((to) => {
  if (process.env.CLIENT) {
    const canonicalLink = document.getElementById("canonical-link")
    const baseUrl = window.location.origin
    if (canonicalLink) canonicalLink.setAttribute("href", `${baseUrl}${to.path}`)
  }
})

export default Router
