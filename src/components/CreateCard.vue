<template lang="pug">
div
  q-card
    //- div {{ req }}
    .q-pa-md
      .centered.items-center.q-gutter-md(style="text-transform: capitalize;" v-if="customModel" )
        h4 Using {{customModel.modelType}} Model:
        h4 {{ customModel?.name }}
        q-btn(round flat icon="edit" @click="pickModel()")
      q-form(@submit="createImage")
        .centered.q-pa-md
          q-input(v-model="req.prompt" :disable="anyLoading"  @keydown="handleKeydown"  color="primary" filled type="textarea" placeholder="Enter a description of the image to create" ).full-width
        .centered.q-ma-md
          q-btn(label="new idea" icon="lightbulb" flat @click="newPrompt()" :loading="loading.new" :disable="anyLoading" )
            .badge
              p 1
          q-btn(label="randomize" icon="shuffle" flat @click="randomizePrompt()" :loading="loading.randomize" :disable="anyLoading || req.prompt?.length < 10" )
            .badge
              p 1
          q-btn(label="improve" icon="arrow_upward" flat @click="improvePrompt()" :loading="loading.improve" :disable="anyLoading || req.prompt?.length < 10" )
            .badge
              p 2
        q-separator(color="grey-9" spaced="20px" inset)
        .centered
          div.q-ma-md
            p Quantity
            .row
              q-input(v-model.number="createStore.req.quantity" type="number" :min="1" :max="10" style="width:45px; max-width:20vw;" no-error-icon :disable="anyLoading ||req.seed != undefined" )
              q-tooltip(v-if="createStore.req.seed")
                p Can't adjust quantity when using custom seed
              .column
                q-btn(size="sm" icon="add" flat round @click="createStore.req.quantity++" :disable="req.quantity >=10 || createStore.req.seed != undefined" )
                q-btn(size="sm" icon="remove" flat round @click="createStore.req.quantity--" :disable="req.quantity <=1 || createStore.req.seed != undefined" )

          div.q-ma-md(v-if="!customModel")
            p.relative-position Model
              .badge
                p {{ selectedModelPrice }}
            .row
              q-select(v-model="createStore.req.model" :options="createStore.availableModels" style="font-size:20px;" :disable="anyLoading" )
          div.q-ma-md
            p Aspect Ratio
            .row
              q-select(v-model="createStore.req.aspectRatio" :options="availableAspectRatios" style="font-size:20px;" :disable="anyLoading" )
          div.q-ma-md
            p {{printPrivacy}}
            .row
              q-toggle( v-model="createStore.req.public" color="primary" :disable="anyLoading" )
          div.q-ma-md
            p Seed
            .row
              q-input(v-model.number="createStore.req.seed" type="number" placeholder="Random" clearable :disable="anyLoading")
              .column(v-if="createStore.req.seed")
                q-btn(size="sm" icon="add" flat round @click="createStore.req.seed++" :disable="!createStore.req.seed" )
                q-btn(size="sm" icon="remove" flat round @click="createStore.req.seed--" :disable="!createStore.req.seed" )
        //- div {{ req }}
        //- .full-width(style="height:20px;")
        q-separator(color="grey-9" spaced="20px" inset)
        .centered(v-if="$userAuth.userData")
          //- div(v-if="!turnstileValidated")
          //-   .row.items-center.q-gutter-md
          //-     div Validating...
          //-     q-spinner
          //-   //- Turnstile( @success="turnstileValidated = true" @expired="turnstileValidated = false" @error="turnstileValidated = false" )
          q-btn( type="submit" label="Create" color="primary" :loading="createStore.loading.create" :disable="anyLoading || totalCost > $userAuth.userData.availablePoints || req.prompt.length < 5" )
            .badge
              p {{ totalCost }}
      div(v-if="$userAuth.userData && totalCost > $userAuth?.userData?.availablePoints|| 0").q-pt-md
        .centered
          p.text-accent.q-pt-md You don't have enough points to create this image
        .centered.q-ma-sm
          q-btn(label="Get more points" color="primary" @click="$router.push({name:'addPoints'})" flat )
            //- p.q-ml-sm  ({{ totalCost }})
</template>
<script lang="ts">
import { defineComponent, PropType } from "vue"
import { useCreateCardStore } from "stores/createCardStore"
import Turnstile from "./Turnstile.vue"
import { CustomModel } from "lib/api"
import { LocalStorage } from "quasar"
import { toObject } from "lib/util"

export default defineComponent({
  components: { Turnstile },
  props: {
    customModel: {
      type: Object as PropType<CustomModel> | null,
      default: null,
      required: false,
    },
  },
  emits: ["created"],
  data() {
    return {
      createStore: useCreateCardStore(),
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
        if (!newModel) return
        this.createStore.req.customModelId = newModel.id
        this.createStore.req.model = "custom"
      },
      immediate: true,
    },
    "createCardStore.req": {
      handler(val) {
        if (this.createStore.req.seed) this.createStore.req.quantity = 1
        if (this.createStore.req.seed == null) this.createStore.req.seed = undefined
        const validRatios = this.createStore.availableAspectRatios
        if (!validRatios.includes(this.createStore.req.aspectRatio)) {
          this.createStore.req.aspectRatio = validRatios[0] as any
        }
        LocalStorage.set("req", this.createStore.req)
      },
      deep: true,
    },
  },
  mounted() {
    console.log("mounted createcard, customModel:", this.customModel)
    if (!this.customModel) this.createStore.setReq(LocalStorage.getItem("req") || this.createStore.req)
  },
  methods: {
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
