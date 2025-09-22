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
import { oauthCallback, authenticateWithTelegram } from "src/lib/privy"
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
        const providerQuery = (route.query.provider as string) || (route.query.privy_oauth_provider as string)
        if (providerQuery === "telegram" || (route.query.hash && route.query.id && route.query.auth_date)) {
          // Telegram callback via widget auth_url
          const tgUser = {
            id: Number(route.query.id),
            first_name: String(route.query.first_name || ""),
            auth_date: Number(route.query.auth_date),
            hash: String(route.query.hash),
            username: route.query.username ? String(route.query.username) : undefined,
            last_name: route.query.last_name ? String(route.query.last_name) : undefined,
            photo_url: route.query.photo_url ? String(route.query.photo_url) : undefined,
          }
          const { token } = await authenticateWithTelegram(tgUser)
          if (!token) throw new Error("Authentication token not found")
          // Link or login based on mode
          const mode = (route.query.mode as string) || "login"
          if (mode === "link") {
            await userAuth.linkPrivyAccount(token)
          } else {
            await userAuth.privyLogin(token)
          }
        } else {
          // Standard OAuth callback
          const code = route.query.privy_oauth_code as string
          const state = route.query.privy_oauth_state as string
          const provider = route.query.privy_oauth_provider as OAuthProviderType

          if (!code || !state || !provider) {
            error.value = "Missing required parameters"
            loading.value = false
            return
          }

          await oauthCallback(code, state, provider)

          // Save the token to localStorage - it's already been set by Privy SDK
          const token = localStorage.getItem("privy:token")

          if (!token) {
            error.value = "Authentication token not found"
            loading.value = false
            return
          }
          await userAuth.privyLogin(token)
        }

        Notify.create({
          type: "positive",
          message: "Successfully authenticated",
          position: "top",
        })

        // Redirect back if returnTo provided; else land on settings
        // Wait a bit for user profile to load
        await new Promise((resolve) => setTimeout(resolve, 100))

        const rawReturnTo = (route.query.returnTo as string) || sessionStorage.getItem("returnTo") || null
        // Treat any returnTo that resolves to the /login pathname (with or without query) as null
        const shouldIgnoreReturnTo = (() => {
          if (!rawReturnTo) return false
          try {
            const u = new URL(rawReturnTo, window.location.origin)
            return u.pathname === "/login"
          } catch {
            return rawReturnTo === "/login"
          }
        })()
        const returnTo = shouldIgnoreReturnTo ? null : rawReturnTo
        const navigateTo = async (pathName: string) => {
          if (window.top && window.top !== window) {
            // If we're in an iframe (Telegram auth_url flow), navigate the parent
            const base = window.location.origin
            const url = pathName.startsWith("/") ? pathName : `/${pathName}`
            window.top.location.replace(base + url)
          } else {
            await router.replace(pathName)
          }
        }
        if (returnTo && typeof returnTo === "string") {
          sessionStorage.removeItem("returnTo")
          await navigateTo(returnTo)
          console.log("Redirecting to:", returnTo)
        } else {
          await navigateTo("/settings")
        }
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
