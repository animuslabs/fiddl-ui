<template lang="pug">
q-page.full-width.full-height.relative-position.bg-black
  div(v-if="userId")
    ProfilePage(:userId="userId")
  div(v-else)
    Landing(:triggerMailForm="showMailForm")
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
  mounted() {
    if (this.$route.name == "newsletter") this.showMailForm = true
  },
  methods: {},
})
</script>
