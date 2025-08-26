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
  q-separator.full-width.q-mt-lg(color="grey-7")
  .centered
    h5 Tonomy Login
  .row.full-width.items-center
    .col-grow
      q-input( filled :model-value="vcString" @update:model-value="val => vcString = String(val)" type="textarea" autogrow placeholder="Paste Tonomy VC (Verifiable Credential)")
    .col-auto
      q-btn( color="primary" flat @click="loginWithTonomy" :loading="loading" label="Login with Tonomy")
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { handleEmailLogin, handleOauthLogin, privy, verifyEmailCode } from "src/lib/privy"
import { Loading, useQuasar } from "quasar"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"
import type { OAuthProviderType } from "@privy-io/js-sdk-core"
import { throwErr } from "lib/util"

export default defineComponent({
  emits: ["close"],
  setup(_, { emit }) {
    const quasar = useQuasar()
    const router = useRouter()
    const email = ref("")
    const loading = ref(false)
    const userAuth = useUserAuth()
    const vcString = ref("")

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
                void router.replace(returnTo)
              } else if (userAuth.userProfile?.username) {
                void router.push({
                  name: "profile",
                  params: { username: userAuth.userProfile.username },
                  query: { tab: "unlocked" },
                })
              } else {
                // Fallback to account route if username not available
                void router.push({ name: "settings" })
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
      if (!vcString.value || vcString.value.trim() === "") {
        quasar.notify({
          color: "negative",
          message: "Please paste your Tonomy VC",
        })
        return
      }
      loading.value = true
      try {
        await userAuth.tonomyLogin(vcString.value)
        await new Promise((resolve) => setTimeout(resolve, 100))
        const returnTo = sessionStorage.getItem("returnTo")
        if (returnTo) {
          sessionStorage.removeItem("returnTo")
          void router.replace(returnTo)
        } else if (userAuth.userProfile?.username) {
          void router.push({
            name: "profile",
            params: { username: userAuth.userProfile.username },
            query: { tab: "unlocked" },
          })
        } else {
          void router.push({ name: "settings" })
        }
        quasar.notify({
          color: "positive",
          message: "Logged in with Tonomy",
        })
      } catch (error: any) {
        quasar.notify({
          color: "negative",
          message: "Tonomy login failed: " + error.message,
        })
        console.error(error)
      } finally {
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
      vcString,
      loading,
      sendEmailCode,
      loginWithOAuth,
      loginWithTonomy,
      loginWithPasskey,
    }
  },
})
</script>
