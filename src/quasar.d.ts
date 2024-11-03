// Import the necessary types from Vue 3
import type { ComponentCustomProperties } from "vue"
import type { Router, RouteLocationAsRelativeGeneric } from "vue-router"
import type { APIType } from "src/lib/api"
import type { UserAuthStore } from "src/stores/userAuth"

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $router: Router
    $route: RouteLocationAsRelativeGeneric
    $api: APIType
    $userAuth: UserAuthStore
  }
}
