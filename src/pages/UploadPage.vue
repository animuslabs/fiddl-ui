<template lang="pug">
q-page
  .centered(v-if="userAuth.loggedIn")
    DropBox(style="width:400px; height:300px; max-width:90vw" @uploaded="handleUploaded").q-ma-md.q-mt-md
  .centered.q-mt-lg(v-else)
    h3 Please login to upload files
</template>

<script lang="ts">
import DropBox from "components/DropBox.vue"
import { useUserAuth } from "src/stores/userAuth"
import { defineComponent } from "vue"


export default defineComponent({
  components: {
    DropBox
  },
  data() {
    return {
      userAuth: useUserAuth()
    }
  },
  methods: {
    handleUploaded(id:string) {
      console.log("uploaded id:", id)
      void this.$router.push({ name: "prompt", params: { id } })
    }
  }
})
</script>
