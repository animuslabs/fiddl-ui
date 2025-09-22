<template lang="pug">
q-page.flex.flex-center
  q-spinner(color="primary" size="3em" v-if="loading")
  div.text-center(v-else-if="error")
    h5 Tonomy Authentication Error
    p {{ error }}
    q-btn(label="Back to Login" color="primary" to="/login")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"
import { ExternalUser } from "@tonomy/tonomy-id-sdk"
import { Notify } from "quasar"

export default defineComponent({
  name: "TonomyCallback",
  setup() {
    const router = useRouter()
    const userAuth = useUserAuth()
    const loading = ref(true)
    const error = ref<string | null>(null)

    const handleCallback = async () => {
      try {
        const { user } = await ExternalUser.verifyLoginResponse()
        const jwt = await user.createClientAuthorization({
          username: (await user.getUsername())?.username,
          foo: "bar",
        })
        await userAuth.tonomyLogin(jwt)

        Notify.create({
          type: "positive",
          message: "Tonomy login successful",
          position: "top",
        })

        await new Promise((r) => setTimeout(r, 100))

        const returnTo = sessionStorage.getItem("returnTo")
        sessionStorage.removeItem("returnTo")
        const normalizedReturnTo = returnTo === "/login" ? null : returnTo

        if (normalizedReturnTo) {
          void router.replace(normalizedReturnTo)
        } else {
          void router.push({ name: "settings" })
        }
      } catch (e: any) {
        console.error("Tonomy auth error:", e)
        error.value = e.message || "Authentication failed"
        loading.value = false
      }
    }

    onMounted(() => {
      void handleCallback()
    })

    return {
      loading,
      error,
    }
  },
})
</script>
