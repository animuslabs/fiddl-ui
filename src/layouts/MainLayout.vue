<template lang="pug">
q-layout
  q-header
    //- q-toolbar
      .row.q-mr-lg.no-wrap.items-center.q-gutter-md
        q-icon(name="img:/reicaller.svg" size="2rem")
        .text-h5.text-weight-light Fiddl.art
        q-tabs.gt-xs
          q-route-tab(:to="{name:'index'}")
            | Home
          q-route-tab(:to="{name:'upload'}")
            | Upload
          q-route-tab(:to="{name:'prompt'}")
            | Prompt
          q-route-tab(:to="{name:'live'}")
            | Live
      .row.justify-end.full-width(v-if="!userAuth.loggedIn")
        q-btn(flat @click="login()" label="login / Register"  size="sm")
        //- q-separator(color="white" vertical)
        //- q-btn(flat @click="register()" label="register" size="sm")
      .row.justify-end.full-width(v-else)
        q-btn(flat @click="userAuth.logout()" label="logout" size="sm" )
  q-page-container.centered
    .centered.bg-dark(style="width:1200px; max-width:100%; height:100%" )
      router-view
</template>

<script lang="ts">
import { Dialog } from "quasar"
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
// import RegisterDialog from "components/dialogs/Register.vue"

export default defineComponent({

  data() {
    return {
      userAuth: useUserAuth()
    }
  },

  methods: {
    login() {
      Dialog.create({
        component: LoginDialog
      })
    }
  }
})
</script>
