import { RouteRecordRaw } from "vue-router"

const routes:RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      { name: "index", path: "", component: () => import("pages/IndexPage.vue") },
      { name: "upload", path: "/upload", component: () => import("pages/UploadPage.vue") },
      { name: "prompt", path: "/promptTranscription/:id?", component: () => import("pages/PromptPage.vue") },
      { name: "live", path: "/live/:id?", component: () => import("pages/LivePage.vue") }
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
