// Forces TS to apply `@quasar/app-vite` augmentations of `quasar` package
// Removing this would break `quasar/wrappers` imports as those typings are declared
//  into `@quasar/app-vite`
// As a side effect, since `@quasar/app-vite` reference `quasar` to augment it,
//  this declaration also apply `quasar` own
//  augmentations (eg. adds `$q` into Vue component context)
/// <reference types="@quasar/app-vite" />

// Import the necessary types from Vue 3 and Vue Router
import "vue"
import { Router, type RouteLocationAsRelativeGeneric } from "vue-router"
import { APIType } from "lib/api"
import { UserAuthStore } from "src/stores/userAuth"
// Extend Vue instance properties
declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $router: Router
    $route: RouteLocationAsRelativeGeneric
    $api: APIType
    $userAuth: UserAuthStore
  }
}
