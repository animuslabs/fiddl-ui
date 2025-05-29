<template lang="pug">
div.column.items-center.q-gutter-md.q-pa-md
  h5.text-center Privy Login

  // Email login
  q-input(
    :model-value="email"
    @update:model-value="val => email = String(val)"
    label="Email"
    type="email"
    class="full-width"
    @keyup.enter="sendEmailCode"
    autocomplete="email"
  )
  q-btn(
    label="Login with Email"
    color="primary"
    @click="sendEmailCode"
    :loading="loading"
    class="full-width"
    icon="mail"
  )

  // OAuth providers
  div.q-gutter-md.q-ma-sm
    q-btn(
      color="white"
      text-color="black"
      class="full-width"
      @click="loginWithOAuth('google')"
      :loading="loading"
      style="border: 1px solid #ddd"
    )
      template(v-slot:default)
        div.row.items-center.no-wrap.full-width
          q-icon(name="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" size="24px" class="q-mr-sm")
          span Login with Google

    q-btn(
      class="full-width"
      @click="loginWithOAuth('twitter')"
      :loading="loading"
      flat
      style="background-color: #000; color: white; border: 1px solid #000"
    )
      template(v-slot:default)
        div.row.items-center.no-wrap.full-width
          q-icon(name="img:/x-logo.svg" size="24px" class="q-mr-sm")
          span Login with X

    q-btn(
      class="full-width"
      @click="loginWithOAuth('github')"
      :loading="loading"
      style="background-color: #24292e; color: white"
    )
      template(v-slot:default)
        div.row.items-center.no-wrap.full-width
          q-icon(name="img:https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png" size="24px" class="q-mr-sm")
          span Login with GitHub

  //- // Passkey login
  //- q-btn(
  //-   label="Login with Passkey"
  //-   color="teal"
  //-   icon="vpn_key"
  //-   @click="loginWithPasskey"
  //-   :loading="loading"
  //-   class="full-width"
  //- )

  // Close button
  div.q-mt-lg
    q-btn(label="Cancel" color="grey" @click="$emit('close')" flat)
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { handleEmailLogin, handleOauthLogin, privy, verifyEmailCode } from "src/lib/privy"
import { useQuasar } from "quasar"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"
import type { OAuthProviderType } from "@privy-io/js-sdk-core"

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

            $q.notify({
              color: "positive",
              message: "Successfully verified",
            })

            const userAuth = useUserAuth()
            const token = localStorage.getItem("privy:token")
            console.log("privy:token", token)
            const reactToken = result.token
            console.log("reactToken", reactToken)
            await userAuth.privyLogin(result.user.id, token || "")

            // Redirect to account page
            void router.push({ name: "account" })
          } catch (error) {
            $q.notify({
              color: "negative",
              message: "Failed to verify code",
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
