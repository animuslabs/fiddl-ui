<template>
  <router-view />
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { Loading, LoadingBar } from "quasar"

export default defineComponent({
  name: "App",
  mounted() {
    void useUserAuth().attemptAutoLogin()
    LoadingBar.setDefaults({
      color: "info",
      size: "3px",
      position: "top",
      reverse: false
    })
  }
})
</script>
