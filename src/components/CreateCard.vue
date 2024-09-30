<template lang="pug">
div
  q-card
    .q-pa-md
      .centered
        //- h4 Describe your vision
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
              q-input(v-model.number="req.quantity" type="number" :min="1" :max="10" style="width:45px; max-width:20vw;" no-error-icon :disable="anyLoading" )
              .column
                q-btn(size="sm" icon="add" flat round @click="req.quantity++" :disable="req.quantity >=10" )
                q-btn(size="sm" icon="remove" flat round @click="req.quantity--" :disable="req.quantity <=1" )
          div.q-ma-md
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
        //- div {{ req }}
        //- .full-width(style="height:20px;")
        q-separator(color="grey-9" spaced="20px" inset)
        .centered(v-if="userAuth.userData")
          q-btn( type="submit" label="Create" color="primary" :loading="loading.create" :disable="anyLoading || totalCost > userAuth.userData.availablePoints || req.prompt.length < 5" )
            .badge
              p {{ totalCost }}
            //- p.q-ml-sm  ({{ totalCost }})
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { useCreateSession } from "stores/createSessionStore"
import { type CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { ImageModelData, imageModelDatas, aspectRatios, ImageModel } from "lib/imageModels"
import { toObject } from "lib/util"
import { Dialog, LocalStorage } from "quasar"
const defaultImageRequest: CreateImageRequest = { prompt: "", model: "core", aspectRatio: "1:1", public: true, quantity: 1 }
const availableModels = Object.freeze(imageModelDatas.map((el) => el.name))
const availableAspectRatios = Object.freeze(aspectRatios)
// const models = Models
export default defineComponent({
  components: {},
  emits: ["created"],
  data() {
    return {
      userAuth: useUserAuth(),
      createSession: useCreateSession(),
      req: defaultImageRequest as CreateImageRequest,
      selectedModel: availableModels[2] as ImageModel,
      availableModels,
      availableAspectRatios,
      privateMode: false,
      loading: {
        new: false,
        randomize: false,
        improve: false,
        create: false,
      },
    }
  },
  computed: {
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
    selectedModel: {
      handler: function (val: any) {
        this.req.model = val
      },
      immediate: false,
    },
  },
  mounted() {
    // this.selectedModel = availableModels[2]!
    this.req = LocalStorage.getItem("req") || defaultImageRequest
    this.privateMode = !this.req.public
    this.selectedModel = this.req.model
  },
  methods: {
    setReq(req: CreateImageRequest) {
      this.selectedModel = req.model
      this.req = toObject(req)
    },
    async newPrompt() {
      this.loading.new = true
      try {
        this.req.prompt = await this.$api.create.randomPrompt.mutate()
      } catch (e: any) {
        console.error(e)
        Dialog.create({
          title: "Error",
          message: e.message,
          ok: true,
        })
      }
      this.loading.new = false
      await this.userAuth.loadUserData()
    },
    async improvePrompt() {
      this.loading.improve = true
      try {
        this.req.prompt = await this.$api.create.improvePrompt.mutate(this.req.prompt)
      } catch (e) {
        console.error(e)
      }
      this.loading.improve = false
      await this.userAuth.loadUserData()
    },
    async randomizePrompt() {
      this.loading.randomize = true
      const existingPrompt = this.req.prompt.length > 0 ? this.req.prompt : undefined
      try {
        this.req.prompt = await this.$api.create.randomPrompt.mutate(existingPrompt)
      } catch (e) {
        console.error(e)
      }
      this.loading.randomize = false
      await this.userAuth.loadUserData()
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
      LocalStorage.set("req", this.req)
      try {
        await this.createSession.generateImage(toObject(this.req))
        this.$emit("created")
      } catch (e) {
        console.error(e)
      }
      this.loading.create = false
      void this.userAuth.loadUserData()
    },
  },
})
</script>
