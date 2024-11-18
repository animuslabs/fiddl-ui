<template lang="pug">
q-page.full-width
  div(v-if="$userAuth.loggedIn").full-width
    .centered
      div(style="max-width:900px;")
        q-tabs(v-model="tab" align="justify" class="full-width")
          q-tab(v-for="tab in tabs" :key="tab.name" :name="tab.name" :label="tab.label")
    div(v-if="tab == 'faceForge'")
      .centered
        faceForgeTab(ref="faceForgeTab")
    div(v-if="tab == 'prompt'")
      PromptTab(:id="1")
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
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import ImageRequestCard from "components/ImageRequestCard.vue"
import { toObject, timeSince, catchErr } from "lib/util"
import { request } from "http"
import { Dialog } from "quasar"
import UploaderCard from "src/components/UploaderCard.vue"
import FaceForgeTab from "src/components/FaceForgeTab.vue"
import PromptTab from "src/components/PromptTab.vue"

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
      createSession: useCreateSession(),
      images: [] as string[],
      createMode: false,
      tab: null as string | null,
      tabs: [
        {
          name: "prompt",
          label: "Prompt",
        },
        {
          name: "faceForge",
          label: "Face Forge",
        },
      ],
    }
  },
  watch: {
    tab: {
      handler(val: string | null) {
        console.log("tab watch triggered", this.tab)
        if (val) void this.$router.replace({ params: { tab: val } })
      },
      deep: true,
      immediate: true,
    },
    "$route.params": {
      handler(val) {
        console.log("route params", val)
        if (val.tab) this.tab = val.tab
        if (!val.tab || val.tab == "") this.tab = "prompt"
      },
      immediate: true,
    },
    "$route.query": {
      async handler(val) {
        const targetfaceForgeId = this.$route.query?.faceForgeId
        if (targetfaceForgeId && typeof targetfaceForgeId == "string") {
          const faceForgeModel = await this.$api.models.getModel.query(targetfaceForgeId).catch(catchErr)
          if (!faceForgeModel) {
            void this.$router.replace({ query: {}, params: { tab: "faceForge" } })
          } else {
            this.tab = "faceForge"
            void this.$nextTick(() => {
              const faceForgeTab = this.$refs.faceForgeTab as InstanceType<typeof FaceForgeTab>
              faceForgeTab.selectModel(faceForgeModel)
            })
          }
        } else {
          void this.$nextTick(() => {
            const faceForgeTab = this.$refs.faceForgeTab as InstanceType<typeof FaceForgeTab>
            if (faceForgeTab) faceForgeTab.selectModel(null)
          })
        }

        console.log(val)
        const targetImageId = this.$route.query?.imageId
        const encodedRequestData = this.$route.query?.requestData
        if (targetImageId && typeof targetImageId == "string") {
          const imageMeta = await this.$api.creations.imageData.query(targetImageId)
          const requestMeta = await this.$api.creations.createRequest.query(imageMeta.imageRequestId)
          console.log(imageMeta, requestMeta)
          console.log("width:", this.$q.screen.width)
          this.setReq(
            {
              aspectRatio: requestMeta.aspectRatio as any,
              model: requestMeta.model as any,
              prompt: requestMeta.prompt || "",
              public: requestMeta.public,
              quantity: 1,
              negativePrompt: requestMeta.negativePrompt,
              seed: imageMeta.seed,
            },
            this.$q.screen.width < 1440,
          )

          Dialog.create({
            title: "Image Parameters Applied",
            message: "The prompt, model, and seed of the image have been added to the create panel. Make small changes to the prompt or seed to get similar images.",
          }).onDismiss(async () => {
            await this.$router.replace({ query: {} })
          })
        } else if (encodedRequestData && typeof encodedRequestData == "string") {
          const decoded = JSON.parse(decodeURIComponent(encodedRequestData))
          this.setReq(decoded, this.$q.screen.width < 1440)
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
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.loadCreations()
        else this.createSession.reset()
      },
    },
  },
  mounted() {
    console.log()
    if (this.$q.screen.width < 1440) this.createMode = true
  },
  methods: {
    // async setImageMeta(){

    // },
    async loadCreations() {
      if (!this.$userAuth.userId) return
      const lastItem = this.createSession.sessionItems[this.createSession.sessionItems.length - 1]
      console.log("lastItem", lastItem)

      const creations = await this.$api.creations.createRequests.query({
        userId: this.$userAuth.userId,
        includeMetadata: true,
        order: "desc",
        endDateTime: lastItem?.createdAt || undefined,
        limit: 15,
      })
      console.log("creations", creations)

      for (const creation of creations) {
        const request: CreateImageRequest = {
          prompt: creation.prompt || "",
          aspectRatio: creation.aspectRatio as any,
          model: creation.model as any,
          public: creation.public,
          quantity: creation.quantity,
          negativePrompt: creation.negativePrompt || undefined,
        }
        this.createSession.addItem({
          id: creation.id,
          imageIds: creation.imageIds,
          request,
          createdAt: new Date(creation.createdAt),
          creatorId: creation.creatorId,
        })
      }
    },
    setReq(request: CreateImageRequest, toggleCreateMode = false) {
      if (toggleCreateMode) this.createMode = true
      void this.$nextTick(() => {
        const createCard = this.$refs.createCard as InstanceType<typeof CreateCard>
        // createCard.req = toObject(request)
        createCard.setReq(request)
      })
    },
    addImage(data: string) {
      console.log("add Image triggered")
      if (this.createMode) this.createMode = false
      // this.createSession.generateImage({ prompt: data })
      // console.log('add image', data)
      // const blobUrl = await api.image.load(data)
      // this.images = [blobUrl, ...this.images]
    },
  },
})
</script>
