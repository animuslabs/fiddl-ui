<template lang="pug">
q-page
  div(v-if="$userAuth.loggedIn")
    .gt-md
      .row.full-height.full-width.no-wrap
        .gt-md
          .centered
            CreateCard.q-mt-md(@created="addImage" style="padding-top:0px; min-width:300px; max-width:600px;" ref="createCard")
        q-scroll-area(style="width:1140px; max-width:90vw; height:calc(100vh - 60px);")
          .centered.q-ma-md
            ImageRequestCard.full-width(v-for="creation in createSession.sessionItems" :creation="creation" :key="creation.id"  @setRequest="setReq")
          .centered.q-ma-md(v-if="createSession.sessionItems.length > 9")
            q-btn(label="Load More" @click="loadCreations()" :disable="createSession.sessionItems.length < 1")
    .lt-lg
      .full-width
        .centered.q-ma-md
          q-btn(label="Create" color="primary" @click="createMode = true" v-if="!createMode")
        div.q-ma-md(v-if="createMode")
          .row
            q-btn(label="Back" color="primary" flat @click="createMode = false")
          .row
            CreateCard(@created="addImage" style="padding-top:0px; min-width:200px; max-width:90vw;" ref="createCard")
      q-scroll-area(style="height:calc(100vh - 175px); width:100vw; " v-if="!createMode").q-pl-lg.q-pr-lg
        ImageRequestCard(v-for="creation in createSession.sessionItems" :creation="creation" :key="creation.id" @setRequest="setReq($event,true)")
        //- ImageRequestCard(v-if="createSession.sessionItems[0]" :creation="createSession.sessionItems[0]" :key="createSession.sessionItems[0].id" @setRequest="setReq(createSession.sessionItems[0].request,true)")
        .centered.q-ma-md(v-if="createSession.sessionItems.length > 9")
          q-btn(label="Load More" @click="loadCreations()" icon="arrow_downward" v-if="createSession.sessionItems.length > 0")
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
import { toObject, timeSince } from "lib/util"
import { request } from "http"
import { Dialog } from "quasar"
export default defineComponent({
  components: {
    CreateCard,
    CreatedImageCard,
    ImageRequestCard,
  },
  data() {
    return {
      timeSince,
      createSession: useCreateSession(),
      images: [] as string[],
      createMode: false,
    }
  },
  watch: {
    "$route.query": {
      async handler(val) {
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
