<template lang="pug">
q-page.full-width.full-height
  div(v-if="userId")
    ProfilePage(:userId="userId")
  .full-height.full-width.bgimg(v-else)
    .centered.q-pt-md
      img(src="/fiddlLogoWithText.svg" style=" max-width: 400px; width:90vw; opacity: 0.9; object-fit: contain;" no-transition loadingShowDelay="2" loading="eager" alt="fiddl logo")
    .centered
      h4.q-ma-md.text-center Create and Earn with Generative Art
    .q-mt-sm
      .centered
        q-card.q-pa-md(style="background-color: rgba(0,0,0,.3); max-width: 90vw; margin: 0 auto;")
          .centered
            h4 Welcome to the Alpha Launch of Fiddl.art
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
            h5 Have fun exploring the site
    .centered.q-mt-lg
      h5 Join the mailing list to be updated on new features and events.
    .centered
      iframe(data-w-type="embedded" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="/mailchimp.html" style="height: 300px; width:500px; max-width:100vw;").bg-dark-page

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
import { UserFile } from "lib/types"
import Landing from "components/Landing.vue"
import ProfilePage from "./ProfilePage.vue"
import { catchErr } from "lib/util"
import { Notify } from "quasar"

export default defineComponent({
  components: {
    Landing,
    ProfilePage,
  },
  data() {
    return {
      passKeyAuth,
      userFiles: [] as UserFile[],
      userId: null as null | string,
    }
  },
  watch: {
    "$route.params": {
      immediate: true,
      deep: true,
      async handler() {
        const username = this.$route.params?.username
        if (!username || typeof username != "string" || username[0] != "@") {
          if (username) void this.$router.replace({ force: true, params: { username: "" } })
          this.userId = null
          return
        }
        const userId = await this.$api.user.findByUsername.query(username.split("@")[1] as string).catch(console.error)
        if (!userId) {
          this.userId = null
          Notify.create({ message: "User not found", color: "negative" })
          void this.$router.replace({ force: true, params: { username: "" } })
          return
        } else {
          this.userId = userId
        }
      },
    },
  },
  async mounted() {},
  methods: {},
})
</script>
