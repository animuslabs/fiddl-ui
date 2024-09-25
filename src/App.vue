<template>
  <router-view />
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { Loading, LoadingBar } from "quasar"
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    setTimeout(() => {
      console.clear()
    }, 10)
  })
}
export default defineComponent({
  name: "App",
  created() {
    // this.$userAuth = useUserAuth()
  },
  mounted() {
    void useUserAuth().attemptAutoLogin()
    LoadingBar.setDefaults({
      color: "info",
      size: "3px",
      position: "top",
      reverse: false,
    })
  },
})
</script>
