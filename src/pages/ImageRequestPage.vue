<template lang="pug">
q-page
  //- h4 Image Request Page
  //- div(v-if="shortId") {{ imageRequests.imageRequests[shortId] }}
  ImageRequestCard(v-if="creation" :creation="creation" @setRequest="editOnCreatePage" hideLinkBtn).q-ma-lg

</template>
<script lang="ts">
import { CreatedItem } from "lib/types"
import { longIdToShort, shortIdToLong, toObject } from "lib/util"
import ImageRequestCard from "src/components/ImageRequestCard.vue"
import { useImageRequests } from "src/stores/imageRequestsStore"
import { defineComponent } from "vue"
export default defineComponent({
  components: {
    ImageRequestCard,
  },
  data() {
    return {
      // imageRequestId: null as string | null,
      imageRequests: useImageRequests(),
      shortId: null as string | null,
      creation: null as CreatedItem | null,
    }
  },
  async mounted() {
    const requestId = this.$route.params?.requestShortId
    if (!requestId || typeof requestId != "string") return void this.$router.push({ name: "browse" })
    console.log("requestId", requestId)
    this.shortId = requestId.length < 25 ? requestId : longIdToShort(requestId)
    void this.$router.replace({ name: "imageRequest", params: { requestShortId: this.shortId } })
    console.log("shortId", this.shortId)
    const req = await this.imageRequests.getRequest(this.shortId)
    if (req) {
      this.creation = {
        id: req.id,
        imageIds: req.imageIds,
        createdAt: new Date(req.createdAt),
        request: {
          aspectRatio: req.aspectRatio as any,
          model: req.model as any,
          prompt: req.prompt as any,
          public: req.public,
          quantity: req.quantity,
          negativePrompt: req.negativePrompt,
          seed: req.seed as any,
        },
      }
    }
  },
  methods: {
    editOnCreatePage() {
      console.log("editOnCreatePage")
      if (!this.creation) return
      const req = toObject(this.creation.request)
      if (req.seed) req.seed = undefined
      const encodedRequest = encodeURIComponent(JSON.stringify(req))
      void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
    },
  },
})
</script>
