<template lang="pug">
q-page.flex.flex-center
  q-spinner(color="primary" size="3em" v-if="loading")
  div.text-center(v-else)
    h5 Authentication
    p Redirecting to login…
    q-btn(label="Go to Login" color="primary" to="/login")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue"
import { useRouter, useRoute } from "vue-router"

export default defineComponent({
  name: "AuthCallbackPage",
  setup() {
    const router = useRouter()
    const route = useRoute()
    const loading = ref(true)

    onMounted(() => {
      try {
        // Legacy fallback for old callback URLs (e.g. Telegram widget)
        // We now use native OAuth provider callbacks and TelegramConnect.
        const returnTo = (route.query.returnTo as string | undefined) || null
        if (returnTo && returnTo !== "/login") {
          sessionStorage.setItem("returnTo", returnTo)
        }
      } catch {}
      void router.replace({ name: "login" })
      loading.value = false
    })

    return {
      loading,
    }
  },
})
</script>
