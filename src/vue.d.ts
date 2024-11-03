import Vue from "vue"

declare module "vue/types/vue" {
  interface Vue {
    $myGlobalFunction: () => string
  }
}
