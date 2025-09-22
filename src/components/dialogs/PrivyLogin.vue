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
    q-btn.q-mr-md( @click="loginWithOAuth('twitter')" :loading="loading" color="black" round padding="12px" )
      template(v-slot:default)
        .centered
          q-icon(name="img:/x-logo.svg" size="24px")
    TelegramConnect(mode="login" round)
  q-separator.full-width.q-mt-lg(color="grey-7")
  .centered
    h5 Tonomy Login
  .row.full-width.items-center
    .col-grow
      q-btn( color="primary" outline @click="loginWithTonomy" :loading="loading" label="Login with Tonomy" icon="login")
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { Loading, useQuasar } from "quasar"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"
import { ExternalUser } from "@tonomy/tonomy-id-sdk"
import TelegramConnect from "src/components/TelegramConnect.vue"
import { completeEmailLoginWithCode, requestEmailLoginCode, startOAuthLogin, type OAuthProvider } from "lib/oauth"

export default defineComponent({
  components: { TelegramConnect },
  emits: ["close"],
  setup(_, { emit }) {
    const quasar = useQuasar()
    const router = useRouter()
    const email = ref("")
    const loading = ref(false)
    const userAuth = useUserAuth()
    // No Telegram widget; we use TelegramConnect component (native device login)

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
        await requestEmailLoginCode(email.value)
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
              const result = await completeEmailLoginWithCode(String(code))
              await userAuth.applyServerSession(result.userId, result.token)

              // Wait for user profile to load
              await new Promise((resolve) => setTimeout(resolve, 100))

              const currentRoute = router.currentRoute.value

              const returnTo = sessionStorage.getItem("returnTo")
              sessionStorage.removeItem("returnTo")
              const normalizedReturnTo = returnTo === "/login" ? null : returnTo

              if (normalizedReturnTo) {
                await router.replace(normalizedReturnTo)
              } else {
                const redirect = currentRoute.query?.redirect
                if (typeof redirect === "string" && redirect) {
                  await router.push({ name: redirect })
                } else {
                  await router.push({ name: "settings" })
                }
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

    const loginWithOAuth = async (provider: OAuthProvider) => {
      loading.value = true
      try {
        const pathname = window.location.pathname
        const rt = pathname === "/login" ? null : pathname + window.location.search
        startOAuthLogin(provider, { returnTo: rt })
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

    return {
      email,
      loading,
      sendEmailCode,
      loginWithOAuth,
      loginWithTonomy,
      loginWithPasskey,
    }
  },
})
</script>
