<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Search

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
  mounted() {},
  methods: {},
})
</script>
