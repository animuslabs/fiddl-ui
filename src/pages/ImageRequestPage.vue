<template lang="pug">
q-page
  h4 Image Request Page
  //- ImageRequestCard(:creation="creation")

</template>
<script lang="ts">
import { CreatedItem } from "lib/types"
import { longIdToShort, shortIdToLong } from "lib/util"
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
  mounted() {
    const requestId = this.$route.params?.requestShortId
    if (!requestId || typeof requestId != "string") return void this.$router.push({ name: "browse" })
    console.log("requestId", requestId)
    const shortId = requestId.length < 25 ? requestId : longIdToShort(requestId)
    void this.$router.replace({ name: "imageRequest", params: { requestShortId: shortId } })
    console.log("shortId", shortId)
    const req = void this.imageRequests.getRequest(shortId)
  },
})
</script>
