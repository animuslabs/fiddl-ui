<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-form(:submit="doRegister")
      .q-ma-md
        .row.justify-center
          h5 PassKey Login / Registration
        //- .centered.q-pt-md
          //- q-btn-toggle(v-model="loginMethod" :options="loginMethods")
        .centered.q-pa-lg
          q-input.full-width(v-if="loginMethod =='email'" label="Email" v-model="email" type="email" :error="loginError" :loading="loading" :disable="loading")
          q-input.full-width(v-if="loginMethod =='phone'" label="Phone Number" v-model="phone" type="tel" mask="phone" :error="loginError" :loading="loading" :disable="loading")
          small.text-negative(v-if="loginError") Login Error
          small.text-negative(v-if="registerError") Registration Error, is this account already registered?
        .centered.q-pa-md(v-if="loading")
          p Having trouble logging in? Try the "send link" login option.

      q-card-actions(align="center").q-mb-md
        //- q-btn(color="grey" flat label="Cancel" @click="onCancelClick()")
        //- q-btn(color="info" flat label="Register" @click="doRegister()" :disable="loading")
        q-btn(color="accent" label="Go" type="submit" :disable="loading" size="lg" rounded icon="bolt").full-width

</template>

<script lang="ts">
import { QDialog, Notify, Dialog, LocalStorage } from "quasar"
import { passKeyAuth } from "lib/auth"
import { useUserAuth } from "src/stores/userAuth"
import umami from "lib/umami"
import { catchErr, getReferredBy } from "lib/util"

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
    async doLogin() {
      try {
        this.loginError = false
        this.registerError = false
        this.loading = true
        const result = await passKeyAuth.findUserId({ email: this.email, phone: this.phone }).catch(catchErr)
        console.log("result", result)
        if (!result) {
          this.loginError = true
          this.loading = false
          umami.track("pkLoginError-findUser")
          return
        }
        await this.userAuth.pkLogin(result)
        Notify.create({ message: "Logged in", color: "positive", icon: "check" })
        this.$router.push({ name: "account" })
        this.hide()
      } catch (error: any) {
        console.error(error)
        this.loginError = true
        this.loading = false
        umami.track("pkLoginError", error.message)
        Dialog.create({ message: "Error logging in: " + error.message + " try send link login", color: "negative" })
      }
    },
    async doRegister() {
      console.log("doRegister")
      this.registerError = false
      this.loginError = false
      const phone = this.phone.length === 0 ? undefined : this.phone
      const email = this.email.length === 0 ? undefined : this.email
      console.log({ phone, email })
      // const referredBy = LocalStorage.getItem("referredBy") as string | undefined
      await this.userAuth
        .registerAndLogin({ phone, email, referredBy: getReferredBy() })
        .then(() => {
          Notify.create({ message: "Logged in", color: "positive", icon: "check" })
          umami.track("pkRegisterSuccess")
          this.hide()
        })
        .catch((el) => {
          console.error(el)
          umami.track("pkRegisterError", el.message)
          // this.registerError = true
          void this.doLogin()
        })
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
