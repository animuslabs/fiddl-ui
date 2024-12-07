// src/shims-vue.d.ts

import { ComponentCustomProperties } from "vue"
import { Router, RouteLocationAsRelativeGeneric } from "vue-router"
import { APIType } from "@/lib/api"
import { UserAuthStore } from "@/stores/userAuth"

declare module "vue" {
  interface ComponentCustomProperties {
    $router: Router
    $route: RouteLocationAsRelativeGeneric
    $api: APIType
    $userAuth: UserAuthStore
  }
}
