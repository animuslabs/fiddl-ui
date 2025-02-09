// Import the necessary types from Vue 3
import type { ComponentCustomProperties } from "vue"
import type { Router, RouteLocationAsRelativeGeneric } from "vue-router"
import type { APIType } from "src/lib/api"
import type { UserAuthStore } from "src/stores/userAuth"
import type { QuasarContext } from "@quasar/app-vite/types/configuration/context"

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $q: QuasarContext
    $router: Router
    $route: RouteLocationAsRelativeGeneric
    $api: APIType
    $userAuth: UserAuthStore
  }
}
