<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Create
  .centered.q-ma-md
    CreatedImageCard(size="lg" v-if="createSession.sessionItems[0]" :createdImage="createSession.sessionItems[0]" style="width:500px; height:auto; ")
  .centered
    CreateCard(@created="addImage")
  .centered
    .centered.q-gutter-lg(style="max-width: 80vw;").q-ma-lg
      div(v-for="(image, index) in createSession.sessionItems" style="overflow:scroll" :key="image.id")
        //- div {{ image }}
        //- q-img(:src="image" height="200px" width="200px").bg-red
        CreatedImageCard(:createdImage="image" style="width:300px; height:auto; " v-if="index > 0")


</template>


<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import CreateCard from "components/CreateCard.vue"
import { StabilityAIContentResponse } from 'lib/types'
import { api } from 'lib/api'
import CreatedImageCard from 'components/CreatedImageCard.vue'
import { useCreateSession } from 'stores/createSessionStore'
export default defineComponent({
  components: {
    CreateCard, CreatedImageCard
  },
  data() {
    return {
      userAuth: useUserAuth(),
      createSession: useCreateSession(),
      images: [] as string[],
      api
    }
  },
  mounted() {
  },
  methods: {
    async addImage(data: string) {
      // this.createSession.generateImage({ prompt: data })
      // console.log('add image', data)
      // const blobUrl = await api.image.load(data)
      // this.images = [blobUrl, ...this.images]
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
