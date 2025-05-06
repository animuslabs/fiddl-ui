<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Login/Register

  div(v-if="!loggingIn && !showPrivyLogin").full-width
    .centered.q-gutter-md.q-mt-md
      q-btn(label="Send Link" flat size="xl" icon="email" color="primary" @click="sendLink")
      q-btn(label="Pangea Login" flat size="xl" icon="lock" color="primary" @click="pangeaLogin")
      q-btn(label="Privy Login" flat size="xl" icon="account_circle" color="primary" @click="showPrivyLogin = true")

    .centered.q-mt-xl
      div.q-ma-md
        q-btn(label="passKey Login (experimental)" flat small color="grey-8" @click="login")

  div(v-else-if="showPrivyLogin").full-width
    .centered.q-my-md
      h3 Privy Login
    .row.justify-center
      .col-12.col-sm-6(style="max-width: 350px")
        PrivyLogin(@close="showPrivyLogin = false")

  div(v-else).full-width
    .centered.q-mt-md
      q-btn(label="login" size="lg" color="primary" @click="handleLoginLink")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
import { Dialog, Loading, Notify } from "quasar"
import SendLink from "src/components/dialogs/SendLink.vue"
import umami from "lib/umami"
import SendText from "src/components/dialogs/SendText.vue"
import { pangeaLogin } from "lib/pangea"
import PrivyLogin from "src/components/dialogs/PrivyLogin.vue"
import { handleEmailLogin, handleOauthLogin } from "src/lib/privy"

export default defineComponent({
  components: {
    LoginDialog,
    PrivyLogin,
  },
  data() {
    return {
      loggingIn: false,
      pangeaLogin,
      showPrivyLogin: false,
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      },
    },
  },
  mounted() {
    // void this.handleLoginLink()
    const loginLink = this.$route.query?.loginLink
    if (!loginLink || typeof loginLink !== "string") return
    else this.loggingIn = true
  },
  methods: {
    async handleLoginLink() {
      const loginLink = this.$route.query?.loginLink
      if (!loginLink || typeof loginLink !== "string") return
      Loading.show({
        message: "Logging you in...",
      })
      try {
        await this.$userAuth.linkLogin(loginLink)
        Notify.create({
          message: "Logged in with link",
          color: "positive",
        })
        await this.$userAuth.loadUserData()
        const redirect = this.$route.query?.redirect as string
        await this.$router.push({ name: redirect || "account" })
        umami.track("linkLogin")
      } catch (e: any) {
        console.error(e)
        Dialog.create({
          message: "Error logging in with link:" + e.message,
          color: "negative",
        }).onDismiss(() => {
          void this.$router.replace({ name: "login" })
        })
        umami.track("linkLoginError", e.message)
      }
      Loading.hide()
    },
    login() {
      umami.track("pkLoginStart")
      Dialog.create({
        component: LoginDialog,
      })
    },
    sendLink() {
      umami.track("sendLinkLoginStart")
      Dialog.create({
        component: SendLink,
      })
    },
    sendText() {
      umami.track("sendLinkLoginStart")
      Dialog.create({
        component: SendText,
      })
    },
  },
})
</script>
