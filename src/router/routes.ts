import { RouteRecordRaw } from "vue-router"

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      { name: "index", path: "", component: () => import("pages/IndexPage.vue") },
      { name: "search", path: "/search", component: () => import("pages/SearchPage.vue") },
      { name: "create", path: "/create", component: () => import("pages/CreatePage.vue") },
      { name: "vote", path: "/vote", component: () => import("pages/VotePage.vue") },
      { name: "mint", path: "/mint", component: () => import("pages/MintPage.vue") },
      { name: "addPoints", path: "/addPoints", component: () => import("pages/AddPointsPage.vue") },
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue")
  }
]

export default routes
