<template lang="pug">
q-page.full-height.full-width.bgimg
  .centered.q-mt-md
    q-img(src="/fiddlLogoWithText.svg" style="width: 400px; opacity: 0.9" no-transition loadingShowDelay="2" loading="eager" )
  .centered
    h4 Create and Earn with Generative Art
  .q-mt-xl
    .centered
      q-card.q-pa-md(style="background-color: rgba(0,0,0,.3); max-width:600px;")
        .centered
          .col-auto
            h3 Welcome to the Alpha Launch of Fiddl.art
        .centered.q-mt-md
          ul
            li
              h5 Create art on the Create page
            li
              h5 Explore other creations on the Browse page
            li
              h5 Purchase an image to download a high resolution version
            li
              h5 Earn points when someone purchases your images
        .centered.q-mt-md
          h3 Have fun exploring the site

  .centered.q-mt-xl
    q-btn(type="a" href="https://twitter.com/fiddlart" icon="fa-brands fa-x-twitter" color="primary" flat)
    q-btn(type="a" href="https://www.instagram.com/fiddl.art" icon="fa-brands fa-instagram" color="primary" flat)
  .full-width(style="height: 15px")
  //- Landing


</template>
<style lang="sass" scoped>
.bgimg
  position: relative
  z-index: 1

  &::before
    content: ""
    background-image: url('/homebg.jpg')
    background-size: cover
    background-position: center
    opacity: 0.4 // Adjust this value for transparency
    position: absolute
    top: 0
    left: 0
    right: 0
    bottom: 0
    z-index: -1 // Keeps the image behind the content
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { passKeyAuth } from "lib/auth"
import { useUserAuth } from "src/stores/userAuth"
import { UserFile } from "lib/types"
import Landing from "components/Landing.vue"

export default defineComponent({
  components: {
    Landing,
  },
  data() {
    return {
      userAuth: useUserAuth(),
      passKeyAuth,
      userFiles: [] as UserFile[],
    }
  },
  watch: {
    "userAuth.loggedIn": {
      immediate: true,
      handler() {},
    },
  },
  mounted() {},
  methods: {},
})
</script>
