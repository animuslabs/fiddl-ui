<template lang="pug">
.centered
  .gt-md
    .row.full-height.full-width.no-wrap
      .gt-md
        .centered
          CreateCard.q-mt-md(
            @created="addImage"
            style="padding-top:0px; min-width:300px; max-width:600px;"
            ref="createCard"
            :customModel="customModel"
          )
      q-scroll-area(
        style="width:1140px; max-width:90vw; height:calc(100vh - 60px);"
      )
        .centered.q-ma-md
          ImageRequestCard.full-width(
            v-for="creation in creationsStore.creations"
            :creation="creation"
            :key="creation.id"
            @setRequest="setReq"
          )
        .centered.q-ma-md(v-if="creationsStore.creations.length > 9")
          q-btn(
            label="Load More"
            @click="creationsStore.loadCreations()"
            :disable="creationsStore.creations.length < 1"
          )
  .lt-lg
    .full-width
      .centered.q-ma-md
        q-btn(
          label="Create"
          color="primary"
          @click="createMode = true"
          v-if="!createMode"
        )
      div.q-ma-md(v-if="createMode")
        .row
          q-btn(
            label="Back"
            color="primary"
            flat
            @click="createMode = false"
          )
        .row
          CreateCard(
            @created="addImage"
            style="padding-top:0px; min-width:200px; max-width:90vw;"
            ref="createCard"
            :customModel="customModel"
          )
    q-scroll-area(
      style="height:calc(100vh - 175px); width:100vw;"
      v-if="!createMode"
    ).q-pl-lg.q-pr-lg
      ImageRequestCard(
        v-for="creation in creationsStore.creations"
        :creation="creation"
        :key="creation.id"
        @setRequest="setReq($event, true)"
      )
      .centered.q-ma-md(v-if="creationsStore.creations.length > 9")
        q-btn(
          label="Load More"
          @click="creationsStore.loadCreations()"
          icon="arrow_downward"
          v-if="creationsStore.creations.length > 0"
        )
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import CreateCard from "components/CreateCard.vue"
import ImageRequestCard from "components/ImageRequestCard.vue"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { Dialog } from "quasar"
import { useCreations } from "stores/creationsStore"
import { CustomModel } from "lib/api"
import { useCreateCardStore } from "src/stores/createCardStore"

export default defineComponent({
  name: "PromptTab",
  components: {
    CreateCard,
    ImageRequestCard,
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
    }
  },
  watch: {
    customModel: {
      immediate: true,
      handler(val) {
        // this.creationsStore.reset()
        if (val) void this.creationsStore.setCustomModelId(val.id)
        else void this.creationsStore.clearCustomModelId()
      },
    },
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.creationsStore.loadCreations()
        else this.creationsStore.reset()
      },
    },
  },
  mounted() {
    console.log("mounted promptTab, customModel", this.customModel)
    if (this.$q.screen.width < 1440) this.createMode = true
  },
  methods: {
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
