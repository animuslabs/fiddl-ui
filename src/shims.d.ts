// src/shims-vue.d.ts

import { ComponentCustomProperties } from "vue"
import { Router, RouteLocationAsRelativeGeneric } from "vue-router"
import { APIType } from "lib/api"
import { UserAuthStore } from "stores/userAuth"
import "quasar-app-extension-ssg/types/vite/quasar-wrappers"

import "quasar/dist/types/feature-flag"

declare module "quasar/dist/types/feature-flag" {
  interface QuasarFeatureFlags {
    ssr: true
    ssg: true
  }
}
declare module "vue" {
  interface ComponentCustomProperties {
    $router: Router
    $route: RouteLocationAsRelativeGeneric
    $api: APIType
    $userAuth: UserAuthStore
  }
}
