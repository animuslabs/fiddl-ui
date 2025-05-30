<template lang="pug">
q-page.flex.flex-center
  q-spinner(color="primary" size="3em" v-if="loading")
  div.text-center(v-else-if="error")
    h5 Authentication Error
    p {{ error }}
    q-btn(label="Back to Login" color="primary" to="/login")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue"
import { useRouter, useRoute } from "vue-router"
import { oauthCallback } from "src/lib/privy"
import { useUserAuth } from "src/stores/userAuth"
import { Notify } from "quasar"
import type { OAuthProviderType } from "@privy-io/js-sdk-core"

export default defineComponent({
  name: "AuthCallbackPage",
  setup() {
    const router = useRouter()
    const route = useRoute()
    const userAuth = useUserAuth()
    const loading = ref(true)
    const error = ref<string | null>(null)

    const handleCallback = async () => {
      try {
        const code = route.query.privy_oauth_code as string
        const state = route.query.privy_oauth_state as string
        const provider = route.query.privy_oauth_provider as OAuthProviderType

        if (!code || !state || !provider) {
          error.value = "Missing required parameters"
          loading.value = false
          return
        }

        const result = await oauthCallback(code, state, provider)

        // Save the token to localStorage - it's already been set by Privy SDK
        const token = localStorage.getItem("privy:token")

        if (!token) {
          error.value = "Authentication token not found"
          loading.value = false
          return
        }

        // Update authentication state in the userAuth store
        await userAuth.privyLogin(token)

        Notify.create({
          type: "positive",
          message: "Successfully authenticated",
          position: "top",
        })

        // Redirect to account page
        void router.push({ name: "account" })
      } catch (err: any) {
        console.error("Authentication error:", err)
        error.value = err.message || "Authentication failed"
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
