<template lang="pug">
q-layout(view="lHh Lpr lFf")
  q-header
    q-toolbar.bg-grey-10
      .row.q-mr-lg.no-wrap.items-center
        q-tabs.gt-xs
          q-route-tab(:to="{ name: 'index' }" no-caps exact)
            .row.no-wrap.cursor-pointer(style="padding-top:5px;" @click="$router.push({ name: 'index' })")
              q-icon(name="img:/fiddlLogo.svg" size="35px").q-mr-sm
              .text-h5(style="font-family: gluten; font-weight: 200; padding-top:4px;") Fiddl.art
          //- q-route-tab(:to="{ name: 'search' }" exact)
          //-   | Search
          q-route-tab(:to="{ name: 'create' }")
            | create
          //- q-route-tab(:to="{ name: 'vote' }")
          //-   | vote
          //- q-route-tab(:to="{ name: 'mint' }")
          //-   | mint
      .row.justify-end.full-width(v-if="!userAuth.loggedIn")
        q-btn(flat @click="login()" label="login / Register"  size="sm")
        //- q-separator(color="white" vertical)
        //- q-btn(flat @click="register()" label="register" size="sm")
      .row.justify-end.full-width.q-gutter-sm(v-else)
        q-btn(rounded padding="0px" :color="pointsColor" v-if="userAuth.userData" @click="$router.push({ name: 'addPoints' })")
          .row.items-center
            div.q-ml-md {{ userAuth?.userData?.availablePoints || 0 }}
            q-img.q-ml-sm(src="/FiddlPointsLogo.svg" style="width:40px; height:40px;")
          q-tooltip
            p Add Fiddl Points
        //- q-btn(flat @click="userAuth.logout()" label="logout" size="sm" )
        q-btn(
          icon="account_circle"
          round
          color="primary"
          @click="menu = true"
        )
        q-menu(
          v-if="menu"
          anchor="bottom right"
          self="top right"
          @mouseleave="menu = false"
          @click="menu = false"
        )
          q-list
            q-item(clickable @click="$router.push({ name: 'account' })" v-close-popup)
              q-item-section
                | My Account
            q-item(clickable @click="$router.push({name:'creations',params:{ accountId:userAuth.userId }})" v-close-popup)
              q-item-section
                | My Creations
            q-item(clickable @click="userAuth.logout()" v-close-popup)
              q-item-section
                | Logout

  q-page-container.centered.bg-grey-10
    .centered.bg-dark(style="width:1800px; max-width:100%; height:100%" )
      router-view
  q-footer
    q-toolbar.bg-grey-10
      //- q-toolbar-title Fiddl.art
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
      userAuth: useUserAuth(),
      menu: false,
    }
  },
  computed: {
    pointsColor() {
      if (!this.userAuth.userData) return "negative"
      return this.userAuth.userData?.availablePoints > 10 ? "grey-9" : "negative"
    },
  },
  methods: {
    login() {
      Dialog.create({
        component: LoginDialog,
      })
    },
  },
})
</script>
