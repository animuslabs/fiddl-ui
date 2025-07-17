<script lang="ts">
import imageGallery from "lib/imageGallery"
import { avatarImg } from "lib/netlifyImg"
import { userGetUsername } from "lib/orval"
import { setSocialMetadata } from "lib/socialMeta"

import type { MediaType, UnifiedRequest } from "lib/types"
import { getReferredBy, setReferredBy } from "lib/util"
import { Loading } from "quasar"
import ImageRequestCard from "src/components/ImageRequestCard.vue"
import { useMediaRequests } from "src/stores/mediaRequestsStore"
import { defineComponent } from "vue"
export default defineComponent({
  components: {
    ImageRequestCard,
  },
  data() {
    return {
      avatarImg,
      creatorUsername: "" as string | null,
      // imageRequestId: null as string | null,
      mediaRequests: useMediaRequests(),
      shortId: null as string | null,
      creation: null as UnifiedRequest | null,
      galleryAutoOpened: false,
    }
  },
  mounted() {
    void this.load()
  },
  methods: {
    async load() {
      const { requestShortId, type, index }: { requestShortId: string; type: MediaType; index?: string } = this.$route.params as any
      if (index && !this.galleryAutoOpened) Loading.show()
      // if (!requestShortId || typeof requestShortId != "string" || !type || typeof type != "string") return void this.$router.push({ name: "browse" })
      this.shortId = requestShortId
      this.creation = await this.mediaRequests.getRequest(this.shortId, type)
      if (!this.creation) return
      void this.loadCreatorProfile()
      if (!this.galleryAutoOpened && index) {
        console.log(index)
        setTimeout(async () => {
          if (!this.creation) return
          Loading.hide()
          this.galleryAutoOpened = true
          await imageGallery.show(this.creation.mediaIds, parseInt(index), this.creation.type, this.creation.id)
        }, 2)
      }
    },
    async loadCreatorProfile() {
      if (!this.creation) return console.error("tried to load user profile before creation was loaded")
      const userResponse = await userGetUsername({ userId: this.creation.creatorId })
      this.creatorUsername = userResponse?.data || null
      if (getReferredBy() != undefined) return
      if (this.creatorUsername) setReferredBy(this.creatorUsername)
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
