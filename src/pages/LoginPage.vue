<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Login/Register
  div(v-if="!loggingIn").full-width
    .centered.q-gutter-md.q-mt-md
      q-btn(label="Send Link" flat size="xl" icon="email" color="primary" @click="sendLink")
    .centered.q-mt-xl
      div.q-ma-md
        q-btn(label="passKey Login (experimental)" flat small color="grey-8" @click="login")
  div(v-else).full-width
    .centered.q-mt-md
      q-btn(label="login" size="lg" color="primary" @click="handleLoginLink")

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
    return {
      loggingIn: false,
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
