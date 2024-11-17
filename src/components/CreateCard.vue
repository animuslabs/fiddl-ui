<template lang="pug">
div
  q-card
    //- div {{ customModel.slug }}
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
              q-input(v-model.number="req.quantity" type="number" :min="1" :max="10" style="width:45px; max-width:20vw;" no-error-icon :disable="anyLoading ||req.seed != undefined" )
              q-tooltip(v-if="req.seed")
                p Can't adjust quantity when using custom seed
              .column
                q-btn(size="sm" icon="add" flat round @click="req.quantity++" :disable="req.quantity >=10 || req.seed != undefined" )
                q-btn(size="sm" icon="remove" flat round @click="req.quantity--" :disable="req.quantity <=1 || req.seed != undefined" )

          div.q-ma-md(v-if="!customModel")
            p.relative-position Model
              .badge
                p {{ selectedModelPrice }}
            .row
              q-select(v-model="selectedModel" :options="availableModels" style="font-size:20px;" :disable="anyLoading" )
          div.q-ma-md
            p Aspect Ratio
            .row
              q-select(v-model="req.aspectRatio" :options="availableAspectRatios" style="font-size:20px;" :disable="anyLoading" )
          div.q-ma-md
            p Private Mode
            .row
              q-toggle( :modelValue="privateMode" @update:model-value="updatePrivateMode" color="primary" :disable="anyLoading" )
          div.q-ma-md
            p Seed
            .row
              q-input(v-model.number="req.seed" type="number" placeholder="Random" clearable :disable="anyLoading")
              .column(v-if="req.seed")
                q-btn(size="sm" icon="add" flat round @click="req.seed++" :disable="!req.seed" )
                q-btn(size="sm" icon="remove" flat round @click="req.seed--" :disable="!req.seed" )
        //- div {{ req }}
        //- .full-width(style="height:20px;")
        q-separator(color="grey-9" spaced="20px" inset)
        .centered(v-if="$userAuth.userData")
          div(v-if="!turnstileValidated")
            .row.items-center.q-gutter-md
              div Validating...
              q-spinner
            //- Turnstile( @success="turnstileValidated = true" @expired="turnstileValidated = false" @error="turnstileValidated = false" )
          q-btn( v-else type="submit" label="Create" color="primary" :loading="loading.create" :disable="anyLoading || totalCost > $userAuth.userData.availablePoints || req.prompt.length < 5" )
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
import { type CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { aspectRatios, ImageModel, imageModelDatas } from "lib/imageModels"
import { catchErr, toObject } from "lib/util"
import { LocalStorage } from "quasar"
import { useCreateSession } from "stores/createSessionStore"
import { defineComponent, PropType } from "vue"
import umami from "lib/umami"
import Turnstile from "./Turnstile.vue"
import { CustomModel } from "lib/api"
import { useCreations } from "src/stores/creationsStore"
const defaultImageRequest: CreateImageRequest = { prompt: "", model: "core", aspectRatio: "1:1", public: true, quantity: 1 }
const availableModels = Object.freeze(imageModelDatas.map((el) => el.name).filter((el) => el != "custom"))
const availableAspectRatios = Object.freeze(aspectRatios)
// const models = Models
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
      createSession: useCreateSession(),
      creations: useCreations(),
      req: defaultImageRequest as CreateImageRequest,
      selectedModel: availableModels[2] as ImageModel,
      availableModels,
      privateMode: false,
      turnstileValidated: true,
      loading: {
        new: false,
        randomize: false,
        improve: false,
        create: false,
      },
    }
  },
  computed: {
    availableAspectRatios() {
      if (this.selectedModel.includes("dall")) return ["1:1", "16:9", "9:16"]
      if (this.selectedModel.includes("flux") || this.selectedModel.includes("custom")) {
        return ["1:1", "16:9", "9:16", "4:5", "5:4"]
      } else return availableAspectRatios
    },
    selectedModelPrice() {
      return imageModelDatas.find((m) => m.name === this.selectedModel)?.pointsCost || 0
    },
    anyLoading() {
      return Object.values(this.loading).some((v) => v)
    },
    totalCost() {
      const modelCost = imageModelDatas.find((m) => m.name === this.req.model)?.pointsCost
      // console.log("model", this.req.model)
      // console.log("modelCost", modelCost)
      if (!modelCost) return 0
      return this.req.quantity * modelCost
    },
  },
  watch: {
    customModel: {
      handler(newModel: CustomModel) {
        if (!newModel) return
        this.req.customModelId = newModel.id
        this.req.model = "custom"
        this.selectedModel = "custom"
      },
      immediate: true,
    },
    selectedModel: {
      handler(newModel: ImageModel) {
        this.req.model = newModel

        // Adjust aspect ratio based on the new model's constraints
        const validRatios = this.availableAspectRatios
        if (!validRatios.includes(this.req.aspectRatio)) {
          this.req.aspectRatio = validRatios[0] as any
        }
      },
      immediate: false,
    },
    req: {
      handler: function (val: any) {
        if (this.req.seed) this.req.quantity = 1
        if (this.req.seed == null) this.req.seed = undefined
        LocalStorage.set("req", this.req)
      },
      deep: true,
    },
  },
  mounted() {
    console.log("mounted createcard, customModel:", this.customModel)
    if (!this.customModel) this.setReq(LocalStorage.getItem("req") || defaultImageRequest)
  },
  methods: {
    pickModel() {
      void this.$router.push({ name: "create", params: { tab: "faceClone" } })
    },
    setReq(req: CreateImageRequest) {
      this.selectedModel = req.model
      this.privateMode = !this.req.public
      this.req = toObject(req)
    },
    async newPrompt() {
      this.loading.new = true
      this.req.prompt = (await this.$api.create.randomPrompt.mutate().catch(catchErr)) || this.req.prompt
      if (this.req.seed) {
        this.req.seed = undefined
        this.req.quantity = 4
      }
      this.loading.new = false
      await this.$userAuth.loadUserData()
      umami.track("newPrompt")
    },
    async improvePrompt() {
      this.loading.improve = true
      this.req.prompt = (await this.$api.create.improvePrompt.mutate(this.req.prompt).catch(catchErr)) || this.req.prompt
      this.loading.improve = false
      await this.$userAuth.loadUserData()
      umami.track("improvePrompt")
    },
    async randomizePrompt() {
      this.loading.randomize = true
      const existingPrompt = this.req.prompt.length > 0 ? this.req.prompt : undefined
      this.req.prompt = (await this.$api.create.randomPrompt.mutate(existingPrompt).catch(catchErr)) || this.req.prompt
      this.loading.randomize = false
      await this.$userAuth.loadUserData()
      umami.track("randomizePrompt")
    },
    updatePrivateMode(val: boolean) {
      this.privateMode = val
      this.req.public = !val
    },
    handleKeydown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault()
        void this.createImage()
      }
    },
    async createImage() {
      this.loading.create = true

      if (!this.customModel) LocalStorage.set("req", this.req)
      // if (this.req.seed == null) this.req.seed = undefined
      if (this.customModel) {
        this.req.customModelId = this.customModel.id
        this.req.model = "custom"
      }

      // await this.createSession.generateImage(toObject(this.req)).catch(catchErr)
      await this.creations.generateImage(toObject(this.req)).catch(catchErr)
      this.$emit("created")
      this.loading.create = false
      void this.$userAuth.loadUserData()
      umami.track("createImage")
    },
  },
})
</script>
