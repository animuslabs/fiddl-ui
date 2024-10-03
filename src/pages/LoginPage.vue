<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Login/Register
  .centered.q-gutter-md.q-mt-md
    //- q-btn(label="Instant" flat size="xl" icon="bolt" @click="login" color="accent")
    //- q-separator(vertical)
    q-btn(label="Send Link" flat size="xl" icon="email" color="primary" @click="sendLink")
  .centered.q-mt-xl
    div.q-ma-md
      //- p Registration happens automatically the first time you login.
      //- .centered.q-mt-md
      q-btn(label="passKey Login (experimental)" flat small color="grey-8" @click="login")
      //- .row
      //-   h4 Instant Login
      //- .row
      //-   p Login with your email or phone number instantly, you can verify your account later.
      //- .row.q-mt-sm
      //-   h4 Send Link Login
      //- .row
      //-   p Receive an email with a special link to login.
      //- p No matter how you register, you can always login with a link.
</template>

<script lang="ts">
import { defineComponent } from "vue"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
import { Dialog, Loading, Notify } from "quasar"
import SendLink from "src/components/dialogs/SendLink.vue"

export default defineComponent({
  components: {
    LoginDialog,
  },
  data() {
    return {}
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
    void this.handleLoginLink()
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
        await this.$router.push({ name: redirect || "index" })
      } catch (e: any) {
        console.error(e)
        this.$q
          .dialog({
            message: "Error logging in with link:" + e.message,
            color: "negative",
          })
          .onDismiss(() => {
            void this.$router.replace({ name: "login" })
          })
      }
      Loading.hide()
    },
    login() {
      Dialog.create({
        component: LoginDialog,
      })
    },
    sendLink() {
      Dialog.create({
        component: SendLink,
      })
    },
  },
})
</script>
