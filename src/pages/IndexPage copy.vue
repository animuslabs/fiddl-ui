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
      .q-ma-lg
        h5 Join the mailing list to be updated on new features and events.
    .centered.q-mt-md
      q-btn(label="Join Mailing List" @click="showMailForm = true" color="primary" size="lg")
    .centered.q-mt-xl
      q-btn(type="a" href="https://twitter.com/fiddlart" icon="fa-brands fa-x-twitter" color="primary" flat)
      q-btn(type="a" href="https://www.instagram.com/fiddl.art" icon="fa-brands fa-instagram" color="primary" flat)
    .full-width(style="height: 15px")
q-dialog(v-model="showMailForm" maximized)
  q-card
    .centered
      iframe(
        src="https://cdn.forms-content-1.sg-form.com/3ee3dc6b-ac50-11ef-bf6d-86ce176a3cb7"
        style="width:600px; max-width:90vw; height:500px; max-height:90vh; max-height:90dvh; border:none;"
      )
    .centered
      q-btn(label="Close" @click="showMailForm = false" color="accent" flat)


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
      showMailForm: false,
      userFiles: [] as UserFile[],
      userId: null as null | string,
    }
  },
  watch: {},
  async mounted() {},
  methods: {},
})
</script>
