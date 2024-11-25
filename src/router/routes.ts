import { RouteRecordRaw } from "vue-router"
import { defineAsyncComponent } from "vue"
// import fs from "fs"
import routeData from "./routeData.json"

const asyncLazyLoad = (path: string) => defineAsyncComponent(() => import(`pages/${path}.vue`))

// const routeData = JSON.parse(fs.readFileSync("./routeData.json", "utf-8"))

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [],
  },
  {
    path: "/avatarCrop",
    component: () => import("pages/AvatarCrop.vue"),
    children: [],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("layouts/MainLayout.vue"),
    children: [{ name: "404", component: () => import("pages/IndexPage.vue"), path: "" }],
  },
]

routeData.forEach((el: any) =>
  routes[0]?.children?.push({
    name: el[0] as string,
    path: el[1] as string,
    component: () => import(`../pages/${el[2] as string}.vue`),
  }),
)
// setTimeout(() => {
//   //@ts-ignore
//   console.log("start routes preload", routes[0]?.children.length)
//   const allRoutes = routes[0]?.children
//   if (!allRoutes) return
//   allRoutes.forEach((route) => {
//     const component = route.component as any
//     if (typeof component === "function") {
//       component().catch((err: any) => {
//         console.warn(`Failed to preload route: ${route.path}`, err)
//       })
//     } else {
//       console.warn(`Failed to preload route: ${route.path}`)
//     }
//   })
// }, 5000)

export default routes
