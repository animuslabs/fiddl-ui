<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Create
  .centered
    CreateCard(@created="addImage")
  .centered
    .centered.q-gutter-lg(style="max-width: 80vw;").q-ma-lg.full-width
      div(v-for="(creation, index) in createSession.sessionItems" style="overflow:scroll" :key="index").full-width
        .row.q-mb-md
          p.ellipsis {{  creation.request.prompt }}
        .row.full-width.q-gutter-lg
          CreatedImageCard(v-for="imageId in creation.imageIds" :imageId="imageId" style="width:300px; height:auto;" :key="imageId")


</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import CreateCard from "components/CreateCard.vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { useCreateSession } from "stores/createSessionStore"
export default defineComponent({
  components: {
    CreateCard,
    CreatedImageCard,
  },
  data() {
    return {
      userAuth: useUserAuth(),
      createSession: useCreateSession(),
      images: [] as string[],
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
  methods: {
    async addImage(data: string) {
      // this.createSession.generateImage({ prompt: data })
      // console.log('add image', data)
      // const blobUrl = await api.image.load(data)
      // this.images = [blobUrl, ...this.images]
    },
  },
})
</script>
