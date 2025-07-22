<template lang="pug">
.centered.full-height.full-width
  .full-width
    .row.full-height.full-width.no-wrap
      .col-auto.q-ml-md( v-if="quasar.screen.gt.sm")
        .centered(style="width:450px; padding:0px;")
          CreateCard.q-mt-md.full-width(
            @created="addImage"
            style="padding-top:0px; min-width:300px; max-width:600px;"
            ref="createCard"
            :customModel="customModel"
            @active-tab="setActiveCreationsStore"
          )
      .col-grow.q-mr-sm.full-height
        q-scroll-area.full-width(:style="quasar.screen.gt.sm?'height:calc(100vh - 60px);':'height:calc(100vh - 110px);'")
          .full-width(style="height:15px;").gt-sm
          .full-width(style="height:75px;").lt-md
          .full-width.relative-position
            .full-width(style="height:55px;")
              q-card.q-pa-sm.fixed-top.blur-bg(style="z-index:100; margin:6px;")
                .row.q-gutter-md.items-center.no-wrap
                  q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
                  q-separator(vertical)
                  //- small Model Filter:
                  q-btn-toggle(v-model="activeCreationsStore.dynamicModel" :options="dynamicModelOptions" size="sm" flat)
                  .col-grow
                .centered.q-mt-md(v-if="quasar.screen.lt.md")
                  q-btn(label="create" size="md" color="primary" rounded  @click="createMode = true")

            .centered
              div(v-if="gridMode == 'list'" v-for="creation in activeCreationsStore.creations"  :key="creation.id").full-width.q-pr-md.q-pl-md
                ImageRequestCard(:creation="creation")
              MediaGallery.q-pl-md.q-pr-md( v-else-if="gridMode == 'mosaic'" @selected-index="showDetails" selectable  :cols-desktop="8" :thumb-size-desktop="165"  :rowHeightRatio="1" layout="mosaic" :mediaObjects="allMediaObjects")
              MediaGallery.q-pl-md.q-pr-md( v-else-if="gridMode == 'grid'" @selected-index="showDetails" selectable  :cols-desktop="5" :thumb-size-desktop="190" style="width:400px;" :rowHeightRatio="1" layout="grid" :mediaObjects="allMediaObjects")
              //- div(v-else v-for="(creation,index) in activeCreationsStore.allCreations"  :key="creation.creationId+'1'")
              //-   CreatedImageCard.q-ma-sm.relative-position.cursor-pointer(:imageId="creation.id" style="width:150px; height:150px;" @click="showDetails(creation.creationId,index)")
          .centered.q-ma-md(v-if="activeCreationsStore.creations.length > 9")
            q-btn(
              label="Load More"
              @click="activeCreationsStore.loadCreations()"
              :disable="activeCreationsStore.creations.length < 1"
            )

  q-dialog(v-model="showRequest")
    q-card
      ImageRequestCard(v-if="selectedRequest" :creation="selectedRequest" @setRequest="showRequest = false" @deleted="showRequest = false" style="max-height:90vh; overflow:auto")
      .centered.q-ma-md
        q-btn(label="Back" @click="showRequest = false" color="accent" flat)
  q-dialog(v-model="createMode" maximized no-route-dismiss)
    q-card(style="width:100vw; max-width:600px; overflow:hidden;")
      .centered.full-width
        CreateCard(
          show-back-btn
          @back="createMode = false"
          @created="addImage"
          style="padding-top:0px; min-width:300px; max-width:600px;"
          ref="createCard"
          :customModel="customModel"
          @active-tab="setActiveCreationsStore"
        ).full-width

</template>

<script lang="ts">
import { defineComponent, PropType, ref } from "vue"
import CreateCard from "components/CreateCard.vue"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import type { CreateImageRequest, CreateImageRequestData, CreateVideoRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { Dialog, LocalStorage } from "quasar"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { CustomModel } from "lib/api"
import { useCreateImageStore } from "src/stores/createImageStore"
import { toObject, sleep } from "lib/util"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { useQuasar } from "quasar"
import { match } from "ts-pattern"
import { useCreateVideo } from "lib/orval"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import mediaViwer from "lib/mediaViewer"
import MediaGallery, { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { img, s3Video } from "lib/netlifyImg"
import type { MediaType, UnifiedRequest } from "lib/types"
export default defineComponent({
  name: "PromptTab",
  components: {
    CreateCard,
    ImageRequestCard,
    CreatedImageCard,
    MediaGallery,
  },
  props: {
    customModel: {
      type: Object as PropType<CustomModel> | null,
      default: null,
      required: false,
    },
  },
  data() {
    return {
      img,
      quasar: useQuasar(),
      createImageStore: useCreateImageStore(),
      createVideoStore: useCreateVideoStore(),
      createMode: false,
      selectedRequest: null as UnifiedRequest | null,
      showRequest: false,
      gridMode: "mosaic" as "list" | "grid" | "mosaic",
      currentTab: "image" as MediaType,
      gridModeOptions: [
        { icon: "dashboard", value: "mosaic" },
        { icon: "grid_view", value: "grid" },
        { icon: "list", value: "list" },
      ],
      imageCreations: useImageCreations(),
      videoCreations: useVideoCreations(),
    }
  },
  computed: {
    allMediaObjects() {
      const data = this.activeCreationsStore.allCreations.map((el) => {
        if (this.currentTab == "image") return { id: el.id, url: img(el.id, "md"), type: "image" as MediaType }
        else return { id: el.id, url: s3Video(el.id, "preview-sm"), type: "video" as MediaType }
      })
      console.log(data)
      return data
    },
    activeCreateStore() {
      return match(this.currentTab)
        .with("image", () => this.createImageStore)
        .with("video", () => this.createVideoStore)
        .run()
    },
    activeCreationsStore() {
      return match(this.currentTab)
        .with("image", () => this.imageCreations)
        .with("video", () => this.videoCreations)
        .run()
    },
    activeImageStore() {
      return this.currentTab === "image" ? this.imageCreations : null
    },
    activeVideoStore() {
      return this.currentTab === "video" ? this.videoCreations : null
    },
    dynamicModelOptions() {
      let modelName
      if (this.currentTab == "image") modelName = this.createImageStore.state.req.model
      else modelName = this.createVideoStore.state.req.model
      if (modelName == "custom") modelName = "custom: " + this.createImageStore.state.req.customModelName
      return [
        { label: "All", value: false },
        { label: modelName, value: true },
      ]
    },
  },
  watch: {
    "activeCreateStore.state.req.model": {
      handler(val: string) {
        this.activeCreationsStore.filter.model = val as any
        if (!this.activeCreationsStore.dynamicModel) {
          this.activeCreationsStore.dynamicModel = true
        } else this.activeCreationsStore.searchCreations()
      },
      immediate: true,
    },
    "$q.screen.lt.md"(val) {
      this.createMode = val
    },
    "activeCreationsStore.dynamicModel": {
      handler(val: boolean) {
        console.log("activeCreationsStore.dynamicModel toggled", val)
        if (val) {
          this.activeCreationsStore.filter.model = this.activeCreateStore.state.req.model
          // if (this.activeImageStore) this.activeImageStore.filter.customModelId = this.createImageStore.state.req.customModelId
          if (this.currentTab == "image") this.imageCreations.filter.customModelId = this.createImageStore.state.req.customModelId
        } else {
          this.activeCreationsStore.filter.model = undefined
          if (this.currentTab == "image") this.imageCreations.filter.customModelId = undefined
        }
        this.activeCreationsStore.searchCreations()
      },
      immediate: true,
      deep: true,
    },

    gridMode(val) {
      // for (const creation of this.creationsStore.creations) {
      //   const card = this.$refs[creation.id] as InstanceType<typeof ImageRequestCard>[] | undefined
      //   if (card && card[0]) card[0].minimized.value = val
      // }
      LocalStorage.set("createPageGridMode2", this.gridMode)
    },
    customModel: {
      immediate: true,
      handler(val) {
        // this.creationsStore.reset()
        if (this.activeImageStore) {
          if (val) void this.activeImageStore.setCustomModelId(val.id)
          else void this.activeImageStore.clearCustomModelId()
        }
      },
    },
    "$userAuth.loggedIn": {
      immediate: false,
      handler(val) {
        if (val) void this.activeCreationsStore.loadCreations()
        else {
          this.imageCreations.reset()
          this.videoCreations.reset()
        }
      },
    },
  },
  async mounted() {
    console.log("mounted promptTab, customModel", this.customModel)
    if (this.quasar.screen.lt.md) this.createMode = true
    console.log("grid mode", LocalStorage.getItem("createPageGridMode2"))
    // await sleep(1000)
    void this.$nextTick(() => {
      this.gridMode = LocalStorage.getItem("createPageGridMode2") || "grid"
    })
  },
  methods: {
    isImageCreations(store: any): store is ReturnType<typeof useImageCreations> {
      return "filter" in store && "customModelId" in store.filter
    },
    setActiveCreationsStore(activeTab: "image" | "video") {
      console.log("set active creations store:", activeTab)
      this.currentTab = activeTab
    },
    showDetails(imageIndex: number) {
      // const creation = this.activeCreationsStore.allCreations[0]
      // if (!creation) return
      // this.selectedRequest = creation
      // this.showRequest = true
      // void mediaViwer.show(
      //   this.activeCreationsStore.allCreations.map((el) => el.id),
      //   imageIndex,
      //   this.currentTab,
      // )
      const mediaObjects: MediaGalleryMeta[] = this.activeCreationsStore.allCreations.map((el) => ({ id: el.id, type: this.currentTab }))
      void mediaViwer.show(mediaObjects, imageIndex)
    },
    setReq(request: Partial<CreateImageRequest | CreateVideoRequest>, toggleCreateMode = false) {
      if (toggleCreateMode) this.createMode = true
      void this.$nextTick(() => {
        // console.log("createCard setReq Triggered", createCard)
        // if(request.)
        this.activeCreateStore.setReq(request as any)
      })
    },
    setMediaMode(mode: MediaType) {
      const createCard = this.$refs.createCard as typeof CreateCard
      console.log("set mode on prompttab:", createCard)
    },
    addImage(data: string) {
      if (this.createMode) this.createMode = false
      console.log(data)
      const latestCreation = this.activeCreationsStore.creations[0]
      if (!latestCreation) return
      console.log(latestCreation)
      // if (this.gridMode) this.showDetails(latestCreation.id)
    },
  },
})
</script>
