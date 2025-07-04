<template lang="pug">
q-layout(view="lHh Lpr lFf" )
  q-header
    q-toolbar.bg-grey-10
      .row.q-mr-lg.no-wrap.items-center
        q-tabs
          q-route-tab(href="https://fiddl.art" no-caps exact).text-white
            .row.no-wrap.cursor-pointer(style="padding-top:5px; padding-bottom:5px;")
              q-icon(name="img:/fiddlLogo.svg" size="35px" style="padding-left:5px;").q-mr-sm
              //- .text-h5(style="font-family: gluten; font-weight: 200; padding-top:4px;") Fiddl.art
          //- q-route-tab(:to="{ name: 'search' }" exact)
          //-   | Search
          q-route-tab(:to="{ name: 'create' }").gt-xs.text-white
            | create
          q-route-tab(:to="{ name: 'browse' }").gt-xs.text-white
            | browse
          q-route-tab(:to="{ name: 'forge' }").gt-xs.text-white
            | Forge
          q-route-tab(href="https://fiddl.art/blog").gt-xs.text-white
            | Blog
          //- q-route-tab(:to="{ name: 'vote' }")
          //-   | vote
          //- q-route-tab(:to="{ name: 'mint' }")
          //-   | mint
      .row.justify-end.full-width(v-if="!$userAuth.loggedIn")
        q-btn(flat @click="login()" label="login / Register"  size="sm")
        //- q-separator(color="white" vertical)
        //- q-btn(flat @click="register()" label="register" size="sm")
      .row.justify-end.full-width.q-gutter-sm(v-else)
        q-btn(rounded padding="0px" :color="pointsColor" v-if="$userAuth.userData" @click="$router.push({ name: 'addPoints' })" )
          .row.items-center
            div.q-ml-md {{ $userAuth?.userData?.availablePoints || 0 }}
            q-img.q-ml-sm(src="/FiddlPointsLogo-sm.svg" style="width:40px; height:40px;" alt="fiddl points logo" no-spinner)
          q-tooltip
            p Add Fiddl Points
        //- q-btn(flat @click="userAuth.logout()" label="logout" size="sm" )
        q-btn(
          round
          padding="1px"

          @click="menu = true"
        )
          q-img(slot="icon" :src="avatarImg($userAuth.userId || 'avatar')" style="width:40px; height:40px;" alt="avatar" placeholder-src="/blankAvatar.webp" :key="reloadAvatar")
        q-menu(
          v-if="menu"
          anchor="bottom right"
          self="top right"
          @mouseleave="menu = false"
          @click="menu = false"
        )
          q-list
            q-item(clickable @click="$router.push({ name: 'settings' })" v-close-popup)
              q-item-section
                .row.items-center
                  q-icon(name="settings" size="20px").q-mr-md
                  div Settings
            q-item(clickable @click="$router.push({name:'creations',params:{ accountId:$userAuth.userId }})" v-close-popup)
              q-item-section
                .row.items-center
                  q-icon(name="photo_library" size="20px").q-mr-md
                  div My Account
            q-item(clickable @click="$userAuth.logout()" v-close-popup)
              q-item-section
                .row.items-center
                  q-icon(name="logout" size="20px").q-mr-md
                  div  Logout

  q-page-container.centered.bg-grey-10
    .centered.bg-dark(style="width:100vw; height:100%" )
      router-view.full-width(style="max-width:1500px;")
      .full-width.q-pa-md.bg-grey-10
        .centered.items-center.q-gutter-md
          q-btn(type="a" href="https://twitter.com/fiddlart" icon="fa-brands fa-x-twitter" color="primary" flat)
          q-btn(type="a" href="https://www.instagram.com/fiddl.art" icon="fa-brands fa-instagram" color="primary" flat)
          q-btn(type="a" href="https://www.facebook.com/fiddlart" icon="fa-brands fa-facebook" color="primary" flat)
          q-btn(type="a" href="https://www.linkedin.com/company/fiddl-art" icon="fa-brands fa-linkedin" color="primary" flat)
          q-btn(type="a" href="https://t.me/fiddlart" icon="fa-brands fa-telegram" color="primary" flat)




  q-footer.lt-lg(color="black").bg-grey-10
    q-tabs(color="black").lt-sm
      q-route-tab(:to="{ name: 'create' }").text-white
        | create
      q-route-tab(:to="{ name: 'browse' }").text-white
        | browse
      q-route-tab(:to="{ name: 'faceForge' }").text-white
        |  Forge
      q-route-tab(href="https://fiddl.art/blog").text-white
        | Blog
</template>

<script lang="ts">
import { Dialog } from "quasar"
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
import { avatarImg } from "lib/netlifyImg"
import reloadAvatar from "lib/reloadAvatar"
// import RegisterDialog from "components/dialogs/Register.vue"

export default defineComponent({
  data() {
    return {
      menu: false,
      avatarImg,
      reloadAvatar,
    }
  },
  computed: {
    pointsColor() {
      if (!this.$userAuth.userData) return "negative"
      return this.$userAuth.userData?.availablePoints > 10 ? "grey-9" : "accent"
    },
  },
  methods: {
    login() {
      void this.$router.push({ name: "login" })
    },
  },
})
</script>
