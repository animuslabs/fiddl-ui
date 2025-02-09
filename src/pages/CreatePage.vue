<template lang="pug">
q-page.full-width
  div(v-if="$userAuth.loggedIn").full-width
    PromptTab(:id="1" ref="promptTab")
  div(v-else)
    .centered.q-mt-xl
      h3 You must be logged in to create images
    .centered
      q-btn(label="Login" color="primary" @click="$router.push({name:'login'})" flat)

</template>

<script lang="ts">
import { defineComponent } from "vue"
import CreateCard from "components/CreateCard.vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { useCreateSession } from "stores/createSessionStore"
import { CreateImageRequest } from "../../../fiddl-server/dist/lib/types/serverTypes"
import ImageRequestCard from "components/ImageRequestCard.vue"
import { toObject, timeSince, catchErr } from "lib/util"
import { request } from "http"
import { Dialog } from "quasar"
import UploaderCard from "src/components/UploaderCard.vue"
import FaceForgeTab from "src/components/FaceForgeTab.vue"
import PromptTab from "src/components/PromptTab.vue"
import { useCreateCardStore } from "src/stores/createCardStore"

export default defineComponent({
  components: {
    CreateCard,
    CreatedImageCard,
    ImageRequestCard,
    UploaderCard,
    FaceForgeTab,
    PromptTab,
  },
  data() {
    return {
      timeSince,
      createStore: useCreateCardStore(),
      images: [] as string[],
      createMode: false,
    }
  },
  watch: {
    "$route.query": {
      async handler(val) {
        const targetImageId = this.$route.query?.imageId
        const encodedRequestData = this.$route.query?.requestData
        if (targetImageId && typeof targetImageId == "string") {
          const imageMeta = await this.$api.creations.imageData.query(targetImageId)
          console.log("imageMeta", imageMeta)
          const requestMeta = await this.$api.creations.createRequest.query(imageMeta.imageRequestId)
          // console.log(imageMeta, requestMeta)
          console.log("width:", this.$q.screen.width)
          const req = {
            customModelId: requestMeta.customModelId,
            aspectRatio: requestMeta.aspectRatio as any,
            model: requestMeta.model as any,
            prompt: requestMeta.prompt || "",
            public: requestMeta.public,
            quantity: 1,
            negativePrompt: requestMeta.negativePrompt,
            seed: imageMeta.seed,
          }
          if (req.model == "custom" && req.customModelId) {
            const customModel = await this.$api.models.getModel.query(req.customModelId).catch(console.error)
            if (!customModel) {
              req.customModelId = undefined
              // req.customModelName = undefined
              req.model = "flux-dev"
              Dialog.create({
                message: "Custom model is private, using flux-dev model instead",
                color: "negative",
                persistent: true,
              })
            }
          }
          this.setReq(req, this.$q.screen.lt.md)

          Dialog.create({
            title: "Image Parameters Applied",
            message: "The prompt, model, and seed of the image have been added to the create panel. Make small changes to the prompt or seed to get similar images.",
          }).onDismiss(async () => {
            await this.$router.replace({ query: {} })
          })
        } else if (encodedRequestData && typeof encodedRequestData == "string") {
          const decoded = JSON.parse(decodeURIComponent(encodedRequestData))
          this.setReq(decoded, this.$q.screen.lt.md)
          Dialog.create({
            title: "Image Parameters Applied",
            message: "The create panel has been updated with the details of the image request.",
          }).onDismiss(async () => {
            await this.$router.replace({ query: {} })
          })
        }
        // }
      },
      immediate: true,
    },
    // "$userAuth.loggedIn": {
    //   immediate: true,
    //   handler(val) {
    //     if (val) void this.loadCreations()
    //     else this.createSession.reset()
    //   },
    // },
  },
  mounted() {
    console.log()
  },
  methods: {
    setReq(request: CreateImageRequest, toggleCreateMode = false) {
      console.log("setReq", toggleCreateMode)
      if (toggleCreateMode) {
        const promptTab = this.$refs.promptTab as InstanceType<typeof PromptTab>
        if (promptTab) promptTab.createMode = true
        this.createMode = true
      }

      this.createStore.setReq(request)
    },
    addImage(data: string) {
      console.log("add Image triggered")
      if (this.createMode) this.createMode = false
    },
  },
})
</script>
