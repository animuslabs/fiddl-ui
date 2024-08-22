<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Create
  .centered
    CreateCard(@created="addImage")
  .centered
    q-list(style="max-width: 80vw;").q-ma-lg
      q-item(v-for="image in images" style="overflow:scroll")
        div {{ image.filepath }}


</template>


<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import CreateCard from "components/CreateCard.vue"
import {StabilityAIContentResponse} from 'lib/types'

export default defineComponent({
  components: {
    CreateCard
  },
  data() {
    return {
      userAuth: useUserAuth(),
      images: [] as StabilityAIContentResponse[]
    }
  },
  mounted(){
  },
  methods: {
    addImage(data:StabilityAIContentResponse){
      console.log('add image', data)
      this.images.push(data)
    }
  },
  watch: {
    "userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      }
    }
  }
})
</script>
