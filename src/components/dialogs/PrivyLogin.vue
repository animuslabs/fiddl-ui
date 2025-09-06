<template lang="pug">
div.column.items-center.q-gutter-md.q-pa-md
  .centered
    h5 Email Login
  .row.full-width.items-center
    .col-grow
      q-input( filled :model-value="email" @update:model-value="val => email = String(val)" type="email" @keyup.enter="sendEmailCode" autocomplete="email" placeholder="Email")
    .col-auto
      q-btn( color="primary" flat @click="sendEmailCode" :loading="loading" icon="send")
  q-separator.full-width.q-mt-lg(color="grey-7")
  .centered
    h5 Social Login
  .row
    q-btn.q-mr-md( color="white" @click="loginWithOAuth('google')" :loading="loading" round padding="12px" )
      template(v-slot:default)
        .centered
          q-icon(name="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg")
    q-btn( @click="loginWithOAuth('twitter')" :loading="loading" color="black" round padding="12px" )
      template(v-slot:default)
        .centered
          q-icon(name="img:/x-logo.svg" size="24px")
    TelegramConnect(mode="login")
  // Telegram widget mount area (rendered on demand)
  div.full-width.q-mt-sm
    div(ref="telegramMount")
  q-separator.full-width.q-mt-lg(color="grey-7")
  .centered
    h5 Tonomy Login
  .row.full-width.items-center
    .col-grow
      q-btn( color="primary" outline @click="loginWithTonomy" :loading="loading" label="Login with Tonomy" icon="login")
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { handleEmailLogin, handleOauthLogin, verifyEmailCode, authenticateWithTelegram, getPrivyAppConfig, privy } from "src/lib/privy"
import { Loading, useQuasar } from "quasar"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"
import type { OAuthProviderType } from "@privy-io/js-sdk-core"
import { ExternalUser } from "@tonomy/tonomy-id-sdk"
import { throwErr } from "lib/util"
import TelegramConnect from "src/components/TelegramConnect.vue"

export default defineComponent({
  components: { TelegramConnect },
  emits: ["close"],
  setup(_, { emit }) {
    const quasar = useQuasar()
    const router = useRouter()
    const email = ref("")
    const loading = ref(false)
    const userAuth = useUserAuth()
    const telegramMount = ref<HTMLElement | null>(null)

    const sendEmailCode = async () => {
      if (!email.value || email.value.trim() === "") {
        quasar.notify({
          color: "negative",
          message: "Please enter your email address",
        })
        return
      }

      loading.value = true
      try {
        await handleEmailLogin(email.value)
        // await privy.auth.email.send
        quasar.notify({
          color: "positive",
          message: "Check your email for a verification code",
        })
        emit("close")
        // Use a simpler dialog approach
        quasar
          .dialog({
            title: "Verification",
            message: `Enter the code sent to your email: ${email.value}`,
            prompt: {
              model: "",
              type: "text",
            },
            cancel: true,
            persistent: true,
          })
          .onOk(async (code) => {
            try {
              Loading.show({
                message: "Logging you in...",
              })
              const result = await verifyEmailCode(email.value, code)
              if (!result.token) throwErr("No token")
              const userAuth = useUserAuth()
              await userAuth.privyLogin(result.token)

              // Wait for user profile to load
              await new Promise((resolve) => setTimeout(resolve, 100))
              // Prefer returning to the page that initiated login
              const returnTo = sessionStorage.getItem("returnTo")
              if (returnTo) {
                sessionStorage.removeItem("returnTo")
                if (returnTo === "/login") void router.replace({ name: "settings" })
                else void router.replace(returnTo)
              }
              Loading.hide()
              quasar.notify({
                color: "positive",
                message: "Successfully verified",
              })
            } catch (error: any) {
              Loading.hide()
              quasar.notify({
                color: "negative",
                message: "Failed to verify code: " + error.message,
              })
              console.error(error)
            }
          })
      } catch (error) {
        quasar.notify({
          color: "negative",
          message: "Failed to send verification code",
        })
        console.error(error)
      } finally {
        loading.value = false
      }
    }

    const loginWithOAuth = async (provider: OAuthProviderType) => {
      loading.value = true
      try {
        const rt = window.location.pathname + window.location.search
        sessionStorage.setItem("returnTo", rt)
        await handleOauthLogin(provider, rt)
      } catch (error) {
        quasar.notify({
          color: "negative",
          message: "Failed to initiate OAuth login",
        })
        console.error(error)
        loading.value = false
      }
    }

    const loginWithTonomy = async () => {
      loading.value = true
      try {
        const rt = window.location.pathname + window.location.search
        sessionStorage.setItem("returnTo", rt)
        await ExternalUser.loginWithTonomy({ callbackPath: "/tonomy/callback", dataRequest: { username: true } })
      } catch (error: any) {
        quasar.notify({
          color: "negative",
          message: "Failed to initiate Tonomy login",
        })
        console.error(error)
        loading.value = false
      }
    }
    const loginWithPasskey = async () => {
      loading.value = true
      try {
        // We'll need to implement the passkey login in the lib/privy.ts file
        // This is a placeholder for now
        quasar.notify({
          color: "info",
          message: "Passkey login not yet implemented",
        })
      } catch (error) {
        quasar.notify({
          color: "negative",
          message: "Failed to initiate passkey login",
        })
        console.error(error)
      } finally {
        loading.value = false
      }
    }

    const renderTelegramWidget = async () => {
      // Clean old content
      if (telegramMount.value) telegramMount.value.innerHTML = ""
      const cfg = await getPrivyAppConfig()
      const botName = "fiddlartbot"
      if (!botName) {
        quasar.notify({ color: "negative", message: "Telegram login not available" })
        return
      }

      // Prefer auth_url flow to avoid CSP issues with onauth callbacks
      const s = document.createElement("script")
      s.async = true
      s.src = "https://telegram.org/js/telegram-widget.js?22"
      s.setAttribute("data-telegram-login", botName)
      s.setAttribute("data-size", "large")
      // Send Telegram auth result to our SPA callback route inside a hidden iframe
      const rt = window.location.pathname + window.location.search
      const redirectUri = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(rt)}&provider=telegram`
      s.setAttribute("data-auth-url", redirectUri)
      s.setAttribute("data-request-access", "write")
      telegramMount.value?.appendChild(s)
      quasar.notify({ color: "info", message: "Click the Telegram button below to continue" })
    }

    const loginWithTelegram = async () => {
      loading.value = true
      try {
        const rt = window.location.pathname + window.location.search
        sessionStorage.setItem("returnTo", rt)
        // Ensure clean Privy session and render widget
        await privy.auth.logout().catch(() => {})
        await renderTelegramWidget()
        // Stop spinner while waiting for widget interaction
        loading.value = false
      } catch (error: any) {
        quasar.notify({ color: "negative", message: "Failed to initiate Telegram login" })
        console.error(error)
        loading.value = false
      }
    }

    return {
      email,
      loading,
      sendEmailCode,
      loginWithOAuth,
      loginWithTonomy,
      loginWithPasskey,
      loginWithTelegram,
      telegramMount,
    }
  },
})
</script>
