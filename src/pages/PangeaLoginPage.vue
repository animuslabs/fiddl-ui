<template lang="pug">
q-page.full-height.full-width


</template>

<script lang="ts">
import { ExternalUser } from "@tonomy/tonomy-id-sdk"
import { pangeaLogin } from "lib/pangea"
import { Dialog, Loading, Notify } from "quasar"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
import { useUserAuth } from "src/stores/userAuth"
import { defineComponent } from "vue"

export default defineComponent({
  components: {
    LoginDialog,
  },
  data() {
    return {
      loggingIn: false,
      pangeaLogin,
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
    void this.handlePangeaPayload()
  },
  methods: {
    async handlePangeaPayload() {
      const loginLink = this.$route.query?.payload as string | undefined
      if (!loginLink) {
        Notify.create({
          message: "No login link found",
          color: "negative",
          onDismiss: () => {
            void this.$router.push("/")
          },
        })
        return
      } else {
        Loading.show({
          message: "Logging you in...",
        })
        try {
          const user = await ExternalUser.verifyLoginRequest()
          console.log("pangea user:", user)
          console.log("username:", await user.getUsername())
          const vc = await user.signVc("https://example.com/user-authorization/1234", "UserAuth", {
            accountName: (await user.getAccountName()).toString(),
          })
          await useUserAuth().pangeaLogin(vc)
          await this.$userAuth.loadUserData()
          Loading.hide()
          const redirect = this.$route.query?.redirect as string
          await this.$router.push({ name: redirect || "account" })
        } catch (e: any) {
          Loading.hide()
          Dialog.create({
            message: "Error logging in: " + e.message,
            color: "negative",
          }).onDismiss(() => {
            void this.$router.push("/")
          })
        }
      }
    },
  },
})
</script>
