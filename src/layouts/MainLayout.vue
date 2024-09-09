<template lang="pug">
q-layout
  q-header
    q-toolbar.bg-grey-10
      .row.q-mr-lg.no-wrap.items-center.q-gutter-md
        q-tabs.gt-xs
          q-route-tab(:to="{ name: 'index' }" no-caps exact)
            .row.no-wrap.cursor-pointer(@click="$router.push({ name: 'index' })")
              q-icon(name="img:/fiddlLogo.svg" size="2rem").q-mr-sm
              .text-h5(style="font-family: gluten; font-weight: 200;") Fiddl.art
          q-route-tab(:to="{ name: 'search' }" exact)
            | Search
          q-route-tab(:to="{ name: 'create' }")
            | create
          q-route-tab(:to="{ name: 'vote' }")
            | vote
          q-route-tab(:to="{ name: 'mint' }")
            | mint
      .row.justify-end.full-width(v-if="!userAuth.loggedIn")
        q-btn(flat @click="login()" label="login / Register"  size="sm")
        //- q-separator(color="white" vertical)
        //- q-btn(flat @click="register()" label="register" size="sm")
      .row.justify-end.full-width(v-else)
        q-btn(icon-right="img:/FiddlPointsLogo.svg" rounded :label="userAuth.userData.availablePoints" :color="pointsColor" v-if="userAuth.userData" @click="$router.push({ name: 'addPoints' })")
          q-tooltip
            p Add Fiddl Points
        q-btn(flat @click="userAuth.logout()" label="logout" size="sm" )
  q-page-container.centered.bg-grey-10
    .centered.bg-dark(style="width:1400px; max-width:100%; height:100%" )
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
  computed: {
    pointsColor() {
      if (!this.userAuth.userData) return 'negative'
      return this.userAuth.userData?.availablePoints > 10 ? 'grey-9' : 'negative'
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
