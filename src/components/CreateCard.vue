<template lang="pug">
div
  q-card
    .q-pa-sm
      //- h4 {{ createStore.req.customModelName }}
      //- .centered.items-center.q-gutter-md(style="text-transform: capitalize;" v-if="customModel" )
      //-   q-btn(round flat icon="edit" @click="pickModel()")
      q-form(@submit="createImage")
        .centered.q-pa-md.relative-position
          q-input(style="resize:none;" v-model="req.prompt" :disable="anyLoading"  @keydown="handleKeydown"  color="primary" filled type="textarea" placeholder="Enter a description of the image to create" ).full-width
          .absolute-bottom-right(style="margin-bottom:30px; margin-right:30px;")
            q-btn(icon="clear" flat @click="req.prompt = ''" :disable="anyLoading" round)
            q-tooltip
              p Clear Prompt
        .centered.q-ma-md
          q-btn( icon="lightbulb" flat @click="newPrompt()" :loading="loading.new" :disable="anyLoading" ).q-mr-md
            .badge-sm
              p 1
            q-tooltip
              p Generate a new prompt
          q-btn( icon="shuffle" flat @click="randomizePrompt()" :loading="loading.randomize" :disable="anyLoading || req.prompt?.length < 10" ).q-mr-md
            .badge-sm
              p 1
            q-tooltip
              p randomize an element of the prompt
          q-btn( icon="arrow_upward" flat @click="improvePrompt()" :loading="loading.improve" :disable="anyLoading || req.prompt?.length < 10" )
            .badge-sm
              p 2
            q-tooltip
              p Improve the prompt
        q-separator(color="grey-9" spaced="20px" inset)
        .centered
          div.q-ma-md
            p Quantity
            .row
              q-input(v-model.number="createStore.req.quantity" type="number" :min="1" :max="100" style="width:45px; max-width:20vw;" no-error-icon :disable="anyLoading ||req.seed != undefined" )
              q-tooltip(v-if="createStore.req.seed")
                p Can't adjust quantity when using custom seed
              .column
                q-btn(size="sm" icon="add" flat round @click="createStore.req.quantity++" :disable="req.quantity >=100 || createStore.req.seed != undefined" )
                q-btn(size="sm" icon="remove" flat round @click="createStore.req.quantity--" :disable="req.quantity <=1 || createStore.req.seed != undefined" )
          div.q-ma-md
            p Aspect Ratio
            .row
              q-select(v-model="createStore.req.aspectRatio" :options="availableAspectRatios" style="font-size:20px;" :disable="anyLoading" )
          div.q-ma-md(v-if="createStore.req.seed")
            p Seed
            .row(style="max-width:150px;").no-wrap
              q-input(v-model.number="createStore.req.seed" type="number" placeholder="Random" clearable :disable="anyLoading")
              .column(v-if="createStore.req.seed")
                q-btn(size="sm" icon="add" flat round @click="createStore.req.seed++" :disable="!createStore.req.seed" )
                q-btn(size="sm" icon="remove" flat round @click="createStore.req.seed--" :disable="!createStore.req.seed" )
        .row
          div.q-ma-md.relative-position
            p Model:
            .row.items-center.relative-position
              .badge-sm
                p {{ selectedModelPrice }}
              q-select(v-model="createStore.req.model" :options="createStore.availableModels" style="font-size:20px;" :disable="anyLoading" )
              div.q-ml-md(v-if="createStore.req.model == 'custom'")
                .row.q-gutter-md
                  h4 {{ createStore.req.customModelName }}
                  q-btn(round flat icon="list" @click="showModelPicker = true")

              //- h4 {{ req.model }}
        //- div {{ req }}
        //- .full-width(style="height:20px;")
        q-separator(color="grey-9" spaced="20px" inset)
        .centered(v-if="$userAuth.userData").relative-position.q-mb-md
          div(style="position:absolute; left:15px; top:0px; ")
            q-btn(label="< Back" color="accent" outline @click="$emit('back')" v-if="showBackBtn")
          div
            q-btn( type="submit" label="Create" color="primary" :loading="createStore.loading.create" :disable="anyLoading || totalCost > $userAuth.userData.availablePoints || req.prompt.length < 5" )
              .badge
                p {{ totalCost }}
          div(style="position:absolute; right:15px; top:0px; ")
            q-toggle( size="sm" v-model="createStore.req.public" color="primary" :disable="anyLoading" :label="printPrivacy")
      div(v-if="$userAuth.userData && totalCost > $userAuth?.userData?.availablePoints|| 0").q-pt-md
        .centered
          p.text-accent.q-pt-md You don't have enough points to create this image
        .centered.q-ma-sm
          q-btn(label="Get more points" color="primary" @click="$router.push({name:'addPoints'})" flat )
            //- p.q-ml-sm  ({{ totalCost }})
      q-dialog(v-model="showModelPicker")
        q-card
          .q-ma-md
            .row
              h5.q-mb-sm Select a custom model
              .col-grow
              q-btn(icon="add" label="create new model" flat color="primary" @click="$router.push({name:'forge',params:{mode:'create'}})")
            q-separator(color="primary").q-mb-lg
            CustomModelsList(@modelClicked="setCustomModel" trainedOnly)

</template>
<style>
textarea::-webkit-resizer {
  display: none;
}
</style>
<script lang="ts">
import { defineComponent, PropType } from "vue"
import { CreateImageRequestWithCustomModel, useCreateCardStore } from "stores/createCardStore"
import Turnstile from "./Turnstile.vue"
import { CustomModel } from "lib/api"
import { LocalStorage, Notify } from "quasar"
import { toObject } from "lib/util"
import CustomModelsList from "./CustomModelsList.vue"
import { useCreations } from "src/stores/creationsStore"
import { ImageModel } from "lib/imageModels"

export default defineComponent({
  components: { Turnstile, CustomModelsList },
  props: {
    showBackBtn: {
      type: Boolean,
      default: false,
      required: false,
    },
    customModel: {
      type: Object as PropType<CustomModel> | null,
      default: null,
      required: false,
    },
  },
  emits: ["created", "back"],
  data() {
    return {
      creationsStore: useCreations(),
      showModelPicker: false,
      createStore: useCreateCardStore(),
      showCreateFaceForge: false,
      showPresets: false,
    }
  },
  computed: {
    printPrivacy() {
      return this.createStore.req.public ? "Public" : "Private"
    },
    req() {
      return this.createStore.req
    },
    loading() {
      return this.createStore.loading
    },
    availableAspectRatios() {
      return this.createStore.availableAspectRatios
    },
    selectedModelPrice() {
      return this.createStore.selectedModelPrice
    },
    anyLoading() {
      return this.createStore.anyLoading
    },
    totalCost() {
      return this.createStore.totalCost
    },
  },
  watch: {
    customModel: {
      handler(newModel) {
        if (!newModel) {
          this.createStore.req.customModelId = undefined
          this.createStore.req.customModelName = undefined
          this.createStore.customModel = null
          // this.createStore.req.model = "flux"
        } else {
          this.createStore.req.customModelId = newModel.id
          this.createStore.req.model = "custom"
        }
      },
      immediate: true,
    },
    "createStore.req.model": {
      handler(val: ImageModel) {
        console.log("model changed", val, this.createStore.req)
        if (val == "custom" && !this.createStore.req.customModelId) {
          console.log(this.createStore.req.customModelId)
          console.log(this.createStore.customModel)
          if (this.createStore.customModel) {
            this.createStore.req.customModelId = this.createStore.customModel.id
            this.createStore.req.customModelName = this.createStore.customModel.name
          }
          if (!this.createStore.req.customModelId && !this.createStore.customModel) {
            console.log("trigger popup")
            if (!this.showModelPicker) this.showModelPicker = true
          }
        }
        if (val != "custom") {
          this.createStore.req.customModelId = undefined
          this.createStore.req.customModelName = undefined
          this.createStore.customModel = null
        }
        if (this.creationsStore.dynamicModel) {
          this.creationsStore.filter.model = val
          this.creationsStore.filter.customModelId = this.createStore.req.customModelId
          this.creationsStore.searchCreations()
        }
      },
      immediate: false,
    },
    "createStore.req": {
      handler(val: CreateImageRequestWithCustomModel) {
        console.log("req changed", toObject(val))
        if (val.seed) val.quantity = 1
        if (val.seed == null) val.seed = undefined
        const validRatios = this.createStore.availableAspectRatios
        if (!validRatios.includes(val.aspectRatio)) {
          val.aspectRatio = validRatios[0] as any
        }

        if (val.model != "custom") {
          val.customModelName = undefined
          val.customModelId = undefined
        } else {
          // if (!this.createStore.req.customModelId) {
          //   console.log("trigger popup")
          //   if (!this.showModelPicker) this.showModelPicker = true
          // }
        }
        LocalStorage.set("req", val)
      },
      deep: true,
      immediate: false,
    },
  },
  mounted() {
    console.log("mounted createcard, customModel:", this.customModel)
    const savedReq = LocalStorage.getItem("req")
    if (savedReq) this.createStore.setReq(savedReq as any)
  },
  methods: {
    async setCustomModel(customModel: CustomModel) {
      this.showModelPicker = false
      this.createStore.req.customModelId = customModel.id
      this.createStore.req.customModelName = customModel.name
      await this.creationsStore.setCustomModelId(customModel.id)
      this.creationsStore.filter.model = "custom"
      this.creationsStore.filter.customModelId = customModel.id
      // this.creationsStore.searchCreations()
      LocalStorage.set("req", this.createStore.req)
    },
    pickModel() {
      this.createStore.pickModel()
    },
    newPrompt() {
      void this.createStore.newPrompt()
    },
    improvePrompt() {
      void this.createStore.improvePrompt()
    },
    randomizePrompt() {
      void this.createStore.randomizePrompt()
    },
    updatePrivateMode(val: boolean) {
      this.createStore.updatePrivateMode(val)
    },
    handleKeydown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault()
        void this.createImage()
      }
    },
    async createImage() {
      await this.createStore.createImage()
      this.$emit("created")
    },
  },
})
</script>
