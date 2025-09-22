<template lang="pug">
q-page.flex.flex-center
  q-spinner(color="primary" size="3em" v-if="loading")
  div.text-center(v-else-if="errorMessage")
    h5 Authentication Error
    p {{ errorMessage }}
    q-btn(label="Back to Login" color="primary" to="/login")
  div.text-center(v-else)
    q-icon(name="check_circle" color="positive" size="4em" class="q-mb-md")
    h5 {{ successTitle }}
    p {{ successMessage }}
    q-btn(label="Continue" color="primary" @click="handleContinue")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Notify } from "quasar"
import { useUserAuth } from "src/stores/userAuth"

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  twitter: "X",
  x: "X",
}

export default defineComponent({
  name: "OAuthProviderCallback",
  setup() {
    const route = useRoute()
    const router = useRouter()
    const userAuth = useUserAuth()

    const loading = ref(true)
    const errorMessage = ref<string | null>(null)
    const successTitle = ref("Authentication Complete")
    const successMessage = ref("You are being redirected...")

    const providerParam = computed(() => String(route.params.provider ?? "").toLowerCase())

    const navigateTo = async (pathName: string) => {
      if (window.top && window.top !== window) {
        const base = window.location.origin
        const url = pathName.startsWith("/") ? pathName : `/${pathName}`
        window.top.location.replace(base + url)
      } else {
        await router.replace(pathName)
      }
    }

    const handleContinue = () => {
      void navigateTo("/settings")
    }

    const handleCallback = async () => {
      const providerKey = providerParam.value
      const providerLabel = PROVIDER_LABELS[providerKey]

      if (!providerLabel) {
        errorMessage.value = "Unsupported authentication provider."
        loading.value = false
        return
      }

      const error = route.query.error as string | undefined
      const errorDetail = (route.query.error_detail as string | undefined) || error
      if (error) {
        errorMessage.value = errorDetail?.replace(/_/g, " ") || "Authentication failed."
        loading.value = false
        return
      }

      const token = route.query.token as string | undefined
      const userId = route.query.userId as string | undefined
      if (!token || !userId) {
        errorMessage.value = "Missing authentication token."
        loading.value = false
        return
      }

      try {
        await userAuth.applyServerSession(userId, token)

        const mode = (route.query.mode as string | undefined) || "login"
        const rawReturnTo = (route.query.returnTo as string | undefined) || sessionStorage.getItem("returnTo") || null
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
        const successText = mode === "link" ? `${providerLabel} account linked successfully.` : `Logged in with ${providerLabel}.`
        successTitle.value = mode === "link" ? "Account Linked" : "Logged In"
        successMessage.value = "Completing setup..."

        Notify.create({
          type: "positive",
          message: successText,
          position: "top",
        })

        await new Promise((resolve) => setTimeout(resolve, 150))

        sessionStorage.removeItem("returnTo")

        if (returnTo) {
          await navigateTo(returnTo)
        } else {
          await navigateTo("/settings")
        }
      } catch (err: any) {
        console.error("OAuth callback error:", err)
        errorMessage.value = err?.message || "Authentication failed."
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      void handleCallback()
    })

    return {
      loading,
      errorMessage,
      successTitle,
      successMessage,
      handleContinue,
    }
  },
})
</script>
