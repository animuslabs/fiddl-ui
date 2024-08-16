<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-form(:submit="doLogin")
      .q-ma-md
        .row.justify-center
          h5 Login / Register
        .centered.q-pt-md
          q-btn-toggle(v-model="loginMethod" :options="loginMethods")
        .centered.q-pa-lg
          q-input.full-width(v-if="loginMethod =='email'" label="Email" v-model="email" type="email" :error="loginError" :loading="loading" :disable="loading")
          q-input.full-width(v-if="loginMethod =='phone'" label="Phone Number" v-model="phone" type="tel" mask="phone" :error="loginError" :loading="loading" :disable="loading")
          small.text-negative(v-if="loginError") Login Error: account may not be registered.
          small.text-negative(v-if="registerError") Registration Error, is this account already registered?

      q-card-actions(align="right")
        q-btn(color="grey" flat label="Cancel" @click="onCancelClick()")
        q-btn(color="info" flat label="Register" @click="doRegister()" :disable="loading")
        q-btn(color="primary" label="Login" type="submit" :disable="loading")

</template>

<script lang="ts">
import { QDialog, Notify } from "quasar"
import { api } from "lib/api"
import { passKeyAuth } from "lib/auth"
import { useUserAuth } from "src/stores/userAuth"


const loginMethods = [
  { label: "email", value: "email" },
  { label: "phone", value: "phone" }
]
export default {
  data() {
    return {
      userAuth: useUserAuth(),
      loginError: false,
      loginMethods,
      loginMethod: "email" as "email" | "phone" | null,
      email: "" as string,
      phone: "" as string,
      loading: false,
      registerError: false
    }
  },
  props: {

  },

  emits: [

    "ok", "hide"
  ],

  methods: {
    async doLogin() {
      this.loginError = false
      this.registerError = false
      this.loading = true
      const result = await passKeyAuth.findUserId({ email: this.email, phone: this.phone }).catch(console.error)
      console.log(result)
      if (!result) {
        this.loginError = true
        this.loading = false
        return
      }
      await this.userAuth.login(result)
      Notify.create({ message: "Logged in", color: "positive", icon: "check" })
      this.hide()
    },
    async doRegister() {
      this.registerError = false
      this.loginError = false
      await this.userAuth.registerAndLogin({ phone: this.phone, email: this.email })
        .then(() => {
          Notify.create({ message: "Logged in", color: "positive", icon: "check" })
          this.hide()
        })
        .catch(el => { this.registerError = true })
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
    }
  },
  watch: {
    email(val:string) {
      if (val.length == 0) this.loginError = false
    },
    loginMethod() {
      this.email = ""
      this.phone = ""
      this.loginError = false
    }
  }
}
</script>
