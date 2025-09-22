<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Login/Register

  div(v-if="!loggingIn && !showPrivyLogin").full-width
    .centered.q-gutter-md.q-mt-md
      q-btn(label="Send Link" flat size="xl" icon="email" color="primary" @click="sendLink")
      //- q-btn(label="Pangea Login" flat size="xl" icon="lock" color="primary" @click="pangeaLogin")
      q-btn(label="Sign in Options" flat size="xl" icon="account_circle" color="primary" @click="showPrivyLogin = true")

    .centered.q-mt-lg
      div.q-pa-md(style="max-width: 320px; width: 100%;")
        q-input(
          :model-value="loginCode"
          @update:model-value="onCodeInput"
          label="Have a login code?"
          outlined
          counter
          maxlength="6"
          :loading="codeLoading"
          :disable="codeLoading"
          autocomplete="one-time-code"
        )
        q-btn(
          class="q-mt-md"
          color="primary"
          label="Login with Code"
          :disable="!canSubmitCode"
          size="lg"
          rounded
          icon-right="login"
          @click="handleCodeLogin"
        ).full-width

    .centered.q-mt-xl
      div.q-ma-md
        q-btn(label="passKey Login (experimental)" flat small color="grey-8" @click="login")

  div(v-else-if="showPrivyLogin").full-width
    //- .centered.q-my-md
    //-   h3 Privy Login
    .row.justify-center
      .col-12.col-sm-6(style="max-width: 350px")
        PrivyLogin

  div(v-else).full-width
    .centered.q-mt-md
      q-btn(
        label="Complete login"
        size="lg"
        color="primary"
        :loading="loginLinkInFlight"
        :disable="loginLinkInFlight"
        icon-right="login"
        @click="handleLoginLink()"
      )
</template>

<script lang="ts">
import { defineComponent } from "vue"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
import { Dialog, Loading, Notify } from "quasar"
import SendLink from "src/components/dialogs/SendLink.vue"
import umami from "lib/umami"
import SendText from "src/components/dialogs/SendText.vue"
// import { pangeaLogin } from "lib/pangea"
import PrivyLogin from "src/components/dialogs/PrivyLogin.vue"
import { extractLoginToken, pickFirstLoginTokenCandidate } from "lib/loginLink"

export default defineComponent({
  components: {
    LoginDialog,
    PrivyLogin,
  },
  data() {
    return {
      loggingIn: false,
      loginLinkInFlight: false,
      showPrivyLogin: true,
      loginCode: "",
      codeLoading: false,
    }
  },
  computed: {
    loginCodeClean(): string {
      return (this.loginCode || "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase()
    },
    canSubmitCode(): boolean {
      return this.loginCodeClean.length >= 6 && !this.codeLoading
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      },
    },
    "$route.query"() {
      if (this.loginLinkInFlight) return
      const token = this.getLoginLinkTokenFromRoute()
      if (!token) return
      this.prepareLoginLinkFlow()
      void this.handleLoginLink(token)
    },
  },
  mounted() {
    const token = this.getLoginLinkTokenFromRoute()
    if (!token) return
    this.prepareLoginLinkFlow()
    void this.handleLoginLink(token)
  },
  methods: {
    prepareLoginLinkFlow() {
      this.showPrivyLogin = false
      this.loggingIn = true
    },
    getLoginLinkTokenFromRoute(): string | null {
      const query = this.$route.query || {}
      return pickFirstLoginTokenCandidate([query.loginLink, query.token, query.payload])
    },
    async handleLoginLink(raw?: string | null) {
      const token = extractLoginToken(raw ?? this.getLoginLinkTokenFromRoute())
      if (!token) {
        this.loggingIn = false
        return
      }
      if (this.loginLinkInFlight) return

      this.loginLinkInFlight = true
      this.loggingIn = true
      this.showPrivyLogin = false

      Loading.show({
        message: "Logging you in...",
      })
      try {
        await this.$userAuth.linkLogin(token)
        Notify.create({
          message: "Logged in with link",
          color: "positive",
        })
        await this.finalizeLoginRedirect("linkLogin")
      } catch (e: any) {
        console.error(e)
        Dialog.create({
          message: "Error logging in with link:" + e.message,
          color: "negative",
        }).onDismiss(() => {
          void this.$router.replace({ name: "login" })
        })
        umami.track("linkLoginError", e.message)
      } finally {
        Loading.hide()
        this.loginLinkInFlight = false
        this.loggingIn = false
      }
    },
    async handleCodeLogin() {
      if (!this.canSubmitCode) return
      this.codeLoading = true
      Loading.show({
        message: "Verifying code...",
      })
      try {
        await this.$userAuth.loginWithCode(this.loginCode)
        Notify.create({
          message: "Logged in with code",
          color: "positive",
        })
        await this.finalizeLoginRedirect("codeLogin")
        this.loginCode = ""
      } catch (e: any) {
        console.error(e)
        Notify.create({
          message: e.message || "Invalid login code",
          color: "negative",
        })
      }
      Loading.hide()
      this.codeLoading = false
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
    async finalizeLoginRedirect(eventName: string) {
      await this.$userAuth.loadUserData()
      await this.$userAuth.loadUserProfile().catch(() => undefined)

      const redirect = this.$route.query?.redirect
      const redirectRoute = typeof redirect === "string" && redirect.length > 0 ? redirect : null

      if (redirectRoute) {
        await this.$router.push({ name: redirectRoute })
      } else {
        await this.$router.push({ name: "settings" })
      }

      umami.track(eventName)
    },
    onCodeInput(value: string) {
      this.loginCode = (value || "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 6)
    },
  },
})
</script>
