<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Creations
  q-scroll-area(style="width:900px; height:400px; max-width:90vw; overflow:auto").q-ma-md
    .centered
      pre.q-ma-md {{ userAuth.userData }}
  //- pre.q-ma-md {{ userAuth.userData }}
  .row.q-gutter-md.q-pa-md
    q-btn(label="refresh" @click="userAuth.loadUserData()")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "src/stores/userAuth"

export default defineComponent({
  components: {},
  data() {
    return {
      userAuth: useUserAuth(),
    }
  },
  watch: {
    "userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      },
    },
  },

  mounted() {
    this.userAuth.loadUserData()
  },
  methods: {},
})
</script>
