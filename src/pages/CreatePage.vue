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
import CreateCard from "components/CreateCard.vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import { getCreationRequest, timeSince } from "lib/util"
import { Dialog, useQuasar } from "quasar"
import PromptTab from "src/components/PromptTab.vue"
import UploaderCard from "src/components/UploaderCard.vue"
import { creationsGetCreationData, modelsGetCustomModel } from "src/lib/orval"
import { useCreateImageStore } from "src/stores/createImageStore"
import { defineComponent } from "vue"
import { CreateImageRequest, CreateVideoRequest } from "../../../fiddl-server/dist/lib/types/serverTypes"
import { MediaType } from "lib/types"
import { createCardStore } from "src/stores/createCardStore"

export default defineComponent({
  components: {
    CreateCard,
    CreatedImageCard,
    ImageRequestCard,
    UploaderCard,
    PromptTab,
  },
  setup() {
    const quasar = useQuasar()
    return { quasar }
  },
  data() {
    return {
      timeSince,
      createStore: useCreateImageStore(),
      images: [] as string[],
      createMode: false,
    }
  },
  watch: {
    "$route.query": {
      async handler(val) {
        const targetMediaId = this.$route.query?.mediaId
        const encodedRequestData = this.$route.query?.requestData
        const mediaType = this.$route.query?.type as MediaType
        if (targetMediaId && typeof targetMediaId == "string") {
          const { data: mediaData } = await creationsGetCreationData({ videoId: mediaType == "video" ? targetMediaId : undefined, imageId: mediaType == "image" ? targetMediaId : undefined })
          const request = await getCreationRequest(mediaData.requestId, mediaType)
          let req: Partial<CreateVideoRequest | CreateImageRequest> = {
            aspectRatio: request.aspectRatio as any,
            model: (request.model as unknown as any) || "",
            prompt: request.prompt || "",
            public: request.public,
            quantity: 1,
            seed: request.seed,
            duration: request.duration,
            customModelId: request.customModelId,
            negativePrompt: request.negativePrompt,
            startImageId: request.startImageId,
          }
          if (req.model == "custom" && req.customModelId) {
            const modelData = await modelsGetCustomModel({ id: req.customModelId }).catch(console.error)
            const customModel = modelData?.data
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
          this.setReq(req, this.quasar.screen.lt.md)
          createCardStore.activeTab = mediaType
          // const promptTab = this.$refs.promptTab as InstanceType<typeof PromptTab>
          // promptTab.setMediaMode(mediaType)

          Dialog.create({
            title: "Image Parameters Applied",
            message: "The prompt, model, and seed of the image have been added to the create panel. Make small changes to the prompt or seed to get similar images.",
          }).onDismiss(async () => {
            await this.$router.replace({ query: {} })
          })
        } else if (encodedRequestData && typeof encodedRequestData == "string") {
          const decoded = JSON.parse(decodeURIComponent(encodedRequestData))
          this.setReq(decoded, this.quasar.screen.lt.md)
          Dialog.create({
            title: "Image Parameters Applied",
            message: "The create panel has been updated with the details of the image request.",
          }).onDismiss(async () => {
            await this.$router.replace({ query: {} })
          })
        }
        console.log("current tab?:", createCardStore.activeTab)
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
    setReq(request: Partial<CreateImageRequest | CreateVideoRequest>, toggleCreateMode = false) {
      console.log("setReq", toggleCreateMode)
      const promptTab = this.$refs.promptTab as InstanceType<typeof PromptTab>
      if (toggleCreateMode) {
        if (promptTab) promptTab.createMode = true
        this.createMode = true
      }
      promptTab.setReq(request)
      // this.createStore.setReq({ ...request })
    },
    addImage(data: string) {
      console.log("add Image triggered")
      if (this.createMode) this.createMode = false
    },
  },
})
</script>
