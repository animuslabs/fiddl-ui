<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-form(:submit="sendLink")
      .q-ma-md
        .row.justify-center
          h5 Send Link to Register/Login
        //- .centered.q-pt-md
        //-   q-btn-toggle(v-model="loginMethod" :options="loginMethods")
        .centered.q-pa-lg
          q-input.full-width(v-if="loginMethod =='email'" label="Email" v-model="email" type="email" :error="loginError" :loading="loading" :disable="loading")
          q-input.full-width(v-if="loginMethod =='phone'" label="Phone Number" v-model="phone" type="tel" mask="phone" :error="loginError" :loading="loading" :disable="loading")

      q-card-actions(align="center").q-mb-md
        //- q-btn(color="grey" flat label="Cancel" @click="onCancelClick()")
        //- q-btn(color="info" flat label="Register" @click="doRegister()" :disable="loading")
        q-btn(color="primary" label="Send Link" type="submit" :disable="loading" size="lg" rounded icon-right="send").full-width

</template>

<script lang="ts">
import { QDialog, Notify, Dialog, LocalStorage } from "quasar"
import { useUserAuth } from "src/stores/userAuth"

const loginMethods = [
  { label: "email", value: "email" },
  { label: "phone", value: "phone" },
]
export default {
  props: {},

  emits: ["ok", "hide"],
  data() {
    return {
      userAuth: useUserAuth(),
      loginError: false,
      loginMethods,
      loginMethod: "email" as "email" | "phone" | null,
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
      const referredBy = LocalStorage.getItem("referredBy") as string | undefined
      try {
        const result = await this.$api.loginLink.initLoginLink.mutate({
          phoneNumber: phone,
          email,
          referredBy,
        })
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
