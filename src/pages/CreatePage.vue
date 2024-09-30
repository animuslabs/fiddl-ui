<template lang="pug">
q-page
  .gt-md
    .row.full-height.full-width.no-wrap
      .gt-md
        .centered
          CreateCard.q-mt-md(@created="addImage" style="padding-top:0px; min-width:300px; max-width:600px;" ref="createCard")
      q-scroll-area(style="width:1140px; max-width:90vw; height:calc(100vh - 60px);")
        .centered.q-ma-md
          ImageRequestCard.full-width(v-for="creation in createSession.sessionItems" :creation="creation" :key="creation.id"  @setRequest="setReq(creation.request)")
        .centered.q-ma-md
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
      ImageRequestCard(v-for="creation in createSession.sessionItems" :creation="creation" :key="creation.id" @setRequest="setReq(creation.request,true)")
      //- ImageRequestCard(v-if="createSession.sessionItems[0]" :creation="createSession.sessionItems[0]" :key="createSession.sessionItems[0].id" @setRequest="setReq(createSession.sessionItems[0].request,true)")
      .centered.q-ma-md
        q-btn(label="Load More" @click="loadCreations()" icon="arrow_downward" v-if="createSession.sessionItems.length > 0")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import CreateCard from "components/CreateCard.vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { useCreateSession } from "stores/createSessionStore"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import ImageRequestCard from "components/ImageRequestCard.vue"
import { toObject, timeSince } from "lib/util"
export default defineComponent({
  components: {
    CreateCard,
    CreatedImageCard,
    ImageRequestCard,
  },
  data() {
    return {
      timeSince,
      userAuth: useUserAuth(),
      createSession: useCreateSession(),
      images: [] as string[],
      createMode: false,
    }
  },
  watch: {
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
    if (this.$q.platform.is.mobile) this.createMode = true
  },
  methods: {
    async loadCreations() {
      if (!this.$userAuth.userId) return
      const lastItem = this.createSession.sessionItems[this.createSession.sessionItems.length - 1]
      console.log("lastItem", lastItem)
      const query = {
        userId: this.$userAuth.userId,
        includeMetadata: true,
        order: "desc" as any,
        endDateTime: lastItem?.createdAt || undefined,
      }
      console.log("query", query)
      const creations = await this.$api.creations.createRequests.query(query)
      console.log("creations", creations)
      for (const creation of creations) {
        const request: CreateImageRequest = {
          prompt: creation.prompt,
          aspectRatio: creation.aspectRatio as any,
          model: creation.model as any,
          public: creation.public,
          quantity: creation.quantity,
          negativePrompt: creation.negativePrompt || undefined,
        }

        this.createSession.addItem({ id: creation.id, imageIds: creation.images.map((el: any) => el.id), request, createdAt: new Date(creation.createdAt) })
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
