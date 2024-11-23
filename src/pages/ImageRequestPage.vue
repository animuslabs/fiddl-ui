<template lang="pug">
q-page
  .q-ma-md
    ImageRequestCard(v-if="creation" :creation="creation" hideLinkBtn @reload="load" )
    p.q-mb-xs Author
    div
      .row(v-if="creation").q-gutter-md.items-center
        .col-auto.bg-grey-10.q-pa-md.cursor-pointer(style="border-radius: 10px;" @click="$router.push({ name: 'profile', params: { username: creatorUsername } })")
          .row.items-center.q-gutter-md
            q-img(:src="avatarImg(creation?.creatorId)" style="width: 50px; height: 50px; border-radius: 50%;").q-mt-md
            h4 @{{ creatorUsername }}

</template>
<script lang="ts">
import { CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import imageGallery from "lib/imageGallery"
import { avatarImg, img } from "lib/netlifyImg"

import { getReferredBy, longIdToShort, setReferredBy, shortIdToLong, toObject } from "lib/util"
import { LocalStorage } from "quasar"
import ImageRequestCard from "src/components/ImageRequestCard.vue"
import { useImageRequests } from "src/stores/imageRequestsStore"
import { defineComponent } from "vue"
export default defineComponent({
  components: {
    ImageRequestCard,
  },
  data() {
    return {
      avatarImg,
      creatorUsername: "",
      // imageRequestId: null as string | null,
      imageRequests: useImageRequests(),
      shortId: null as string | null,
      creation: null as CreateImageRequestData | null,
    }
  },
  mounted() {
    void this.load()
  },
  methods: {
    async load() {
      const requestId = this.$route.params?.requestShortId
      if (!requestId || typeof requestId != "string") return void this.$router.push({ name: "browse" })
      console.log("requestId", requestId)
      this.shortId = requestId.length < 25 ? requestId : longIdToShort(requestId)
      // void this.$router.replace({ name: "imageRequest", params: { requestShortId: this.shortId } })
      console.log("shortId", this.shortId)
      const req = await this.imageRequests.getRequest(this.shortId)
      console.log("req", req)
      if (req) {
        this.creation = {
          id: req.id,
          imageIds: req.imageIds,
          createdAt: new Date(req.createdAt),
          creatorId: req.creatorId,
          aspectRatio: req.aspectRatio,
          model: req.model,
          prompt: req.prompt,
          public: req.public,
          quantity: req.quantity,
          negativePrompt: req.negativePrompt,
          seed: req.seed,
          customModelId: req.customModelId,
          customModelName: req.customModelName,
        }
        this.creatorUsername = (await this.$api.user.getUsername.query(req.creatorId).catch(console.error)) || ""
        const targetIndex = this.$route.query?.index
        console.log("targetIndex", targetIndex)
        if (targetIndex != undefined && typeof targetIndex == "string") {
          const creatorMeta = { id: req.creatorId, username: this.creatorUsername }
          void imageGallery.show(this.creation.imageIds, parseInt(targetIndex), this.creation.id, creatorMeta)
          // setSocialMetadata("Dynamic Page Title", "This is a dynamic description for social sharing.", img(this.creation.imageIds[parseInt(targetIndex)] as string, "md"))
        }
        const referrerAlreadySet = getReferredBy()
        if (referrerAlreadySet) return
        const creatorUsername = await this.$api.user.getUsername.query(req.creatorId)
        if (creatorUsername) setReferredBy(creatorUsername)
      }
    },
    editOnCreatePage() {
      console.log("TODO editOnCreatePage")
      // if (!this.creation) return
      // const req = toObject(this.creation)
      // delete req.imageIds
      // delete
      // if (req.seed) req.seed = undefined
      // const encodedRequest = encodeURIComponent(JSON.stringify(req))
      // void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
    },
  },
})
</script>
