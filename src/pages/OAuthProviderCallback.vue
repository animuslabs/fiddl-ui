<template lang="pug">
q-page.flex.flex-center
  q-spinner(color="primary" size="3em" v-if="loading")
  div.text-center(v-else-if="errorMessage")
    h5 Authentication Error
    p {{ errorMessage }}
    q-btn(label="Back to Login" color="primary" to="/login")
  div.text-center(v-else-if="conflict")
    q-icon(name="warning_amber" color="warning" size="4em" class="q-mb-md")
    h5 {{ providerLabel }} Already Linked
    p This {{ providerLabel }} account is already linked to another Fiddl account. What would you like to do?
    .row.q-gutter-sm.justify-center.q-mt-sm
      q-btn(:disable="actionLoading" label="Login to that account" color="primary" @click="loginOther")
      q-btn(:loading="actionLoading" outline color="warning" label="Unlink there and link here" @click="unlinkAndRelink")
      q-btn(:disable="actionLoading" flat color="grey-5" label="Cancel" @click="cancelConflict")
  div.text-center(v-else)
    q-icon(name="check_circle" color="positive" size="4em" class="q-mb-md")
    h5 {{ successTitle }}
    p {{ successMessage }}
    q-btn(label="Continue" color="primary" @click="handleContinue")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Notify, Loading } from "quasar"
import { useUserAuth } from "src/stores/userAuth"
import { startOAuthLogin } from "src/lib/oauth"
import { userUnlinkOAuth } from "src/lib/orval"

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
    const conflict = ref(false)
    const actionLoading = ref(false)
    const otherToken = ref<string | null>(null)
    const otherUserId = ref<string | null>(null)
    const plannedReturnTo = ref<string | null>(null)

    const providerParam = computed(() => String(route.params.provider ?? "").toLowerCase())
    const providerLabel = computed(() => PROVIDER_LABELS[providerParam.value] || "Provider")
    const oauthProviderForStart = computed<"google" | "twitter">(() => (providerParam.value === "google" ? "google" : "twitter"))

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
      const provLabel = PROVIDER_LABELS[providerKey]

      if (!provLabel) {
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
        const mode = (route.query.mode as string | undefined) || "login"
        const rawReturnTo = (route.query.returnTo as string | undefined) || sessionStorage.getItem("returnTo") || null
        plannedReturnTo.value = rawReturnTo

        // Detect link conflict: we attempted to link but OAuth returned a session for a different user
        try {
          const initiatorUserId = sessionStorage.getItem("linkInitiatorUserId")
          if (initiatorUserId && initiatorUserId !== userId) {
            otherToken.value = token
            otherUserId.value = userId
            conflict.value = true
            loading.value = false
            return
          }
        } catch {}

        await userAuth.applyServerSession(userId, token)

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
        const successText = mode === "link" ? `${provLabel} account linked successfully.` : `Logged in with ${provLabel}.`
        successTitle.value = mode === "link" ? "Account Linked" : "Logged In"
        successMessage.value = "Completing setup..."

        Notify.create({
          type: "positive",
          message: successText,
          position: "top",
        })

        await new Promise((resolve) => setTimeout(resolve, 150))

        sessionStorage.removeItem("returnTo")
        sessionStorage.removeItem("linkInitiatorUserId")
        sessionStorage.removeItem("linkInitiatorProvider")
        sessionStorage.removeItem("linkInitiatorAt")

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
      conflict,
      actionLoading,
      providerLabel,
      handleContinue,
      async loginOther() {
        if (!otherToken.value || !otherUserId.value) return
        try {
          actionLoading.value = true
          await userAuth.applyServerSession(otherUserId.value, otherToken.value)
          const rawReturnTo = plannedReturnTo.value || sessionStorage.getItem("returnTo") || null
          sessionStorage.removeItem("returnTo")
          sessionStorage.removeItem("linkInitiatorUserId")
          sessionStorage.removeItem("linkInitiatorProvider")
          sessionStorage.removeItem("linkInitiatorAt")
          Notify.create({ type: "positive", message: `Logged in with ${providerLabel.value}.`, position: "top" })
          await new Promise((r) => setTimeout(r, 100))
          if (rawReturnTo) {
            await navigateTo(rawReturnTo)
          } else {
            await navigateTo("/settings")
          }
        } catch (e: any) {
          Notify.create({ type: "negative", message: e?.message || "Failed to switch account" })
        } finally {
          actionLoading.value = false
        }
      },
      cancelConflict() {
        try {
          sessionStorage.removeItem("returnTo")
          sessionStorage.removeItem("linkInitiatorUserId")
          sessionStorage.removeItem("linkInitiatorProvider")
          sessionStorage.removeItem("linkInitiatorAt")
        } catch {}
        void navigateTo("/settings")
      },
      async unlinkAndRelink() {
        if (!otherToken.value) return
        try {
          actionLoading.value = true
          Loading.show({ message: "Preparing to link..." })
          const apiProvider = providerParam.value === "google" ? "google" : "x"
          await userUnlinkOAuth({ provider: apiProvider as any }, { headers: { Authorization: `Bearer ${otherToken.value}` } })
          // Clear markers and start a fresh link from the current account
          sessionStorage.removeItem("returnTo")
          sessionStorage.removeItem("linkInitiatorUserId")
          sessionStorage.removeItem("linkInitiatorProvider")
          sessionStorage.removeItem("linkInitiatorAt")
          const rt = "/settings"
          startOAuthLogin(oauthProviderForStart.value, { mode: "link", returnTo: rt })
        } catch (e: any) {
          console.error("Failed to unlink other account:", e)
          Notify.create({ type: "negative", message: e?.message || "Couldn't unlink from the other account." })
        } finally {
          Loading.hide()
          actionLoading.value = false
        }
      },
    }
  },
})
</script>
