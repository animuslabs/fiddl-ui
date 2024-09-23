<template lang="pug">
q-page.full-height.full-width.bgimg
  .centered.q-mt-md
    q-img(src="/fiddlLogo2.webp" style="width: 400px; opacity: 0.9" no-transition loadingShowDelay="2" loading="eager" )
  .centered.q-mt-md
    h1 Fiddl.art
  .centered
    h5 Create, Vote, Earn with generative artwork.
  .centered.q-mt-lg
    //- iframe(data-w-type="embedded" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://9sql.mjt.lu/wgt/9sql/xut5/form?c=8268c5ed" style="height: 500px; width:500px;").bg-dark-page
  .centered
    q-btn(type="a" href="https://twitter.com/fiddlart" icon="fa-brands fa-x-twitter" color="primary" flat)
    q-btn(type="a" href="https://www.instagram.com/fiddl.art" icon="fa-brands fa-instagram" color="primary" flat)
  .full-width(style="height: 15px")


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

export default defineComponent({
  components: {},
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
