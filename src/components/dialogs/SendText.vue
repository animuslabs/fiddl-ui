<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-form(:submit="sendLink")
      .q-ma-md
        .row.justify-center
          h5 Send Text Message to Register/Login
        .centered.q-pa-lg
          q-input.full-width(v-if="loginMethod =='phone'" label="Phone Number" v-model="phone" type="tel" mask="phone" :error="loginError" :loading="loading" :disable="loading")
        .row
          q-checkbox(v-model="confirm" )
            div {{ message }}
          a(href="https://fiddl.art/tos" style="margin-left:40px;" target="_blank") Privacy Policy

      q-card-actions(align="center").q-mb-md.q-pa-md
        //- q-btn(color="grey" flat label="Cancel" @click="onCancelClick()")
        //- q-btn(color="info" flat label="Register" @click="doRegister()" :disable="loading")
        q-btn(color="primary" label="Send Link" type="submit" :disable="loading || !confirm" size="lg" rounded icon-right="send").full-width

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { loginLinkInitLoginLink } from "src/lib/orval"
import { getReferredBy } from "lib/util"
import { QDialog, Notify, Dialog, LocalStorage } from "quasar"
import { useUserAuth } from "src/stores/userAuth"
import { getClientTracking } from "lib/tracking"

const loginMethods = [
  { label: "email", value: "email" },
  { label: "phone", value: "phone" },
]

const message = "By checking this box you agree to receive text messages from ; Reply STOP to opt out; Reply HELP for help; Message frequency varies; Message and data rates may apply;"
export default {
  props: {},

  emits: ["ok", "hide"],
  data() {
    return {
      message,
      userAuth: useUserAuth(),
      loginError: false,
      loginMethods,
      confirm: false,
      loginMethod: "phone" as "email" | "phone" | null,
      email: "" as string,
      phone: "" as string,
      loading: false,
      registerError: false,
    }
  },
  watch: {
    email(val: string) {
      if (val.length == 0) this.loginError = false
    },
    loginMethod() {
      this.email = ""
      this.phone = ""
      this.loginError = false
    },
  },

  methods: {
    async sendLink() {
      let email = this.email.length > 0 ? this.email : undefined
      let phone = this.phone.length > 0 ? this.phone : undefined
      if (!phone && !email) return
      this.loading = true
      try {
        const response = await loginLinkInitLoginLink({
          phoneNumber: phone,
          email,
          referredBy: getReferredBy(),
          tracking: getClientTracking(),
        })
        const result = response?.data
        Dialog.create({
          message: result,
          color: "primary",
        }).onDismiss(() => {
          this.$router.push({ name: "index" })
        })
      } catch (err: any) {
        Notify.create({
          message: err.message,
          color: "negative",
        })
      }

      this.loading = false
    },
    show() {
      const dialog = this.$refs.dialog as QDialog
      dialog.show()
    },
    hide() {
      const dialog = this.$refs.dialog as QDialog
      dialog.hide()
    },

    onDialogHide() {
      this.$emit("hide")
    },

    onOKClick() {
      this.$emit("ok")

      this.hide()
    },

    onCancelClick() {
      this.hide()
    },
  },
}
</script>
