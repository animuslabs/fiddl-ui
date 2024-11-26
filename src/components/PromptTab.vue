<template lang="pug">
.centered.full-height.full-width
  .full-width
    .row.full-height.full-width.no-wrap
      .col-auto.q-ml-md( v-if="$q.screen.gt.sm")
        .centered(style="width:450px; padding:0px;")
          CreateCard.q-mt-md.full-width(
            @created="addImage"
            style="padding-top:0px; min-width:300px; max-width:600px;"
            ref="createCard"
            :customModel="customModel"
          )
      .col-grow.q-mr-sm.full-height
        q-scroll-area.full-width(:style="$q.screen.gt.sm?'height:calc(100vh - 60px);':'height:calc(100vh - 110px);'")
          .full-width(style="height:15px;")
          .full-width.relative-position
            .full-width(style="height:55px;")
              q-card.q-pa-sm.fixed-top.blur-bg(style="z-index:100; margin:16px;")
                .row.q-gutter-md.items-center.no-wrap
                  q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
                  //- small Model Filter:
                  q-btn-toggle(v-model="creationsStore.dynamicModel" :options="dynamicModelOptions" size="sm" flat)
                  .col-grow
                  q-btn(label="create" size="sm" color="primary" rounded v-if="$q.screen.lt.md" @click="createMode = true")

            .centered
              div(v-if="!gridMode" v-for="creation in creationsStore.creations"  :key="creation.id").full-width.q-pr-md.q-pl-md
                ImageRequestCard(:creation="creation")
              div(v-else v-for="image in creationsStore.allCreationImages"  :key="image.creationId+'1'")
                CreatedImageCard.q-ma-sm.relative-position.cursor-pointer(:imageId="image.imageId" style="width:150px; height:150px;" @click="showDetails(image.creationId)")
          .centered.q-ma-md(v-if="creationsStore.creations.length > 9")
            q-btn(
              label="Load More"
              @click="creationsStore.loadCreations()"
              :disable="creationsStore.creations.length < 1"
            )

  q-dialog(v-model="showRequest")
    q-card
      ImageRequestCard(v-if="selectedRequest" :creation="selectedRequest" @setRequest="showRequest = false" @deleted="showRequest = false" style="max-height:90vh; overflow:auto")
      .centered.q-ma-md
        q-btn(label="Back" @click="showRequest = false" color="accent" flat)
  q-dialog(v-model="createMode" maximized)
    q-card(style="width:100vw; max-width:600px;")
      .centered.full-width
        CreateCard(
          show-back-btn
          @back="createMode = false"
          @created="addImage"
          style="padding-top:0px; min-width:300px; max-width:600px;"
          ref="createCard"
          :customModel="customModel"
        ).full-width

</template>

<script lang="ts">
import { defineComponent, PropType, ref } from "vue"
import CreateCard from "components/CreateCard.vue"
import ImageRequestCard from "components/ImageRequestCard.vue"
import { CreateImageRequest, CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import { Dialog, LocalStorage } from "quasar"
import { useCreations } from "stores/creationsStore"
import { CustomModel } from "lib/api"
import { useCreateCardStore } from "src/stores/createCardStore"
import { toObject } from "lib/util"
import CreatedImageCard from "components/CreatedImageCard.vue"
export default defineComponent({
  name: "PromptTab",
  components: {
    CreateCard,
    ImageRequestCard,
    CreatedImageCard,
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
      creationsStore: useCreations(),
      createStore: useCreateCardStore(),
      createMode: false,
      selectedRequest: null as CreateImageRequestData | null,
      showRequest: false,
      gridMode: false,
      gridModeOptions: [
        { icon: "grid_view", value: true },
        { icon: "list", value: false },
      ],
    }
  },
  computed: {
    dynamicModelOptions() {
      let modelName = this.createStore.req.model
      if (modelName == "custom") modelName = "custom: " + this.createStore.req.customModelName
      return [
        { label: "All", value: false },
        { label: modelName, value: true },
      ]
    },
  },
  watch: {
    "$q.screen.lt.md"(val) {
      this.createMode = val
    },
    "creationsStore.dynamicModel": {
      handler(val: boolean) {
        if (val) {
          this.creationsStore.filter.model = this.createStore.req.model
          this.creationsStore.filter.customModelId = this.createStore.req.customModelId
        } else {
          this.creationsStore.filter.model = undefined
          this.creationsStore.filter.customModelId = undefined
        }
        this.creationsStore.searchCreations()
      },
      immediate: true,
    },
    gridMode(val) {
      // for (const creation of this.creationsStore.creations) {
      //   const card = this.$refs[creation.id] as InstanceType<typeof ImageRequestCard>[] | undefined
      //   if (card && card[0]) card[0].minimized.value = val
      // }
      LocalStorage.set("creatPageGridMode", this.gridMode)
    },
    customModel: {
      immediate: true,
      handler(val) {
        // this.creationsStore.reset()
        if (val) void this.creationsStore.setCustomModelId(val.id)
        else void this.creationsStore.clearCustomModelId()
      },
    },
    "$userAuth.loggedIn": {
      immediate: false,
      handler(val) {
        if (val) void this.creationsStore.loadCreations()
        else this.creationsStore.reset()
      },
    },
  },
  mounted() {
    console.log("mounted promptTab, customModel", this.customModel)
    if (this.$q.screen.lt.md) this.createMode = true
    this.gridMode = LocalStorage.getItem("creatPageGridMode") || false
  },
  methods: {
    showDetails(creationId: string) {
      const creation = this.creationsStore.creations.find((el) => el.id === creationId)
      if (!creation) return
      this.selectedRequest = creation
      this.showRequest = true
    },
    setReq(request: CreateImageRequest, toggleCreateMode = false) {
      if (toggleCreateMode) this.createMode = true
      void this.$nextTick(() => {
        // const createCard = this.$refs.createCard as InstanceType<typeof CreateCard>
        // console.log("createCard setReq Triggered", createCard)
        this.createStore.setReq(request)
      })
    },
    addImage(data: string) {
      if (this.createMode) this.createMode = false
    },
  },
})
</script>
