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
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { handleEmailLogin, handleOauthLogin, privy, verifyEmailCode } from "src/lib/privy"
import { useQuasar } from "quasar"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"
import type { OAuthProviderType } from "@privy-io/js-sdk-core"
import { throwErr } from "lib/util"

export default defineComponent({
  emits: ["close"],
  setup(_, { emit }) {
    const $q = useQuasar()
    const router = useRouter()
    const email = ref("")
    const loading = ref(false)

    const sendEmailCode = async () => {
      if (!email.value || email.value.trim() === "") {
        $q.notify({
          color: "negative",
          message: "Please enter your email address",
        })
        return
      }

      loading.value = true
      try {
        await handleEmailLogin(email.value)
        // await privy.auth.email.send
        $q.notify({
          color: "positive",
          message: "Check your email for a verification code",
        })
        emit("close")
        // Use a simpler dialog approach
        $q.dialog({
          title: "Verification",
          message: `Enter the code sent to your email: ${email.value}`,
          prompt: {
            model: "",
            type: "text",
          },
          cancel: true,
          persistent: true,
        }).onOk(async (code) => {
          try {
            const result = await verifyEmailCode(email.value, code)
            if (!result.token) throwErr("No token")
            $q.notify({
              color: "positive",
              message: "Successfully verified",
            })
            const userAuth = useUserAuth()
            await userAuth.privyLogin(result.token)

            // Redirect to account page
            void router.push({ name: "account" })
          } catch (error: any) {
            $q.notify({
              color: "negative",
              message: "Failed to verify code: " + error.message,
            })
            console.error(error)
          }
        })
      } catch (error) {
        $q.notify({
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
        await handleOauthLogin(provider)
      } catch (error) {
        $q.notify({
          color: "negative",
          message: "Failed to initiate OAuth login",
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
        $q.notify({
          color: "info",
          message: "Passkey login not yet implemented",
        })
      } catch (error) {
        $q.notify({
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
      loginWithPasskey,
    }
  },
})
</script>
