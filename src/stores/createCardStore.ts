// stores/createCardStore.ts
import { defineStore } from "pinia"
import type { CreateImageRequest } from "../../../fiddl-server/dist/lib/types/serverTypes"
import { aspectRatios, ImageModel, imageModelDatas } from "lib/imageModels"
import { LocalStorage } from "quasar"
import { toObject, catchErr } from "lib/util"
import { useCreateSession } from "stores/createSessionStore"
import { useCreations } from "src/stores/creationsStore"
import umami from "lib/umami"
import { CustomModel } from "lib/api"
import { useUserAuth } from "src/stores/userAuth"
import { createImprovePrompt, createRandomPrompt, modelsGetModel } from "lib/orval"
import { useRouter } from "vue-router"

const defaultImageRequest: CreateImageRequest = {
  prompt: "",
  model: "core",
  aspectRatio: "1:1",
  public: true,
  quantity: 1,
}

export type CreateImageRequestWithCustomModel = CreateImageRequest & { customModelName?: string; customModelId?: string }

const availableModels = Object.freeze(imageModelDatas.map((el) => el.name))
const availableAspectRatios = Object.freeze(aspectRatios)

export const useCreateCardStore = defineStore("createCardStore", {
  state: () => {
    const loadedRequest = LocalStorage.getItem("req") as CreateImageRequestWithCustomModel | null
    const router = useRouter()
    return {
      createSession: useCreateSession(),
      creations: useCreations(),
      req: loadedRequest ? loadedRequest : { ...defaultImageRequest },
      availableModels,
      userAuth: useUserAuth(),
      privateMode: false,
      turnstileValidated: true,
      // router: useCreateRouter(),
      router,
      loading: {
        new: false,
        randomize: false,
        improve: false,
        create: false,
      },
      customModel: null as CustomModel | null,
    }
  },
  getters: {
    availableAspectRatios(state) {
      if (state.req.model.includes("dall") || state.req.model.includes("gpt-image")) return ["1:1", "16:9", "9:16"]
      if (["flux-dev,flux-pro,flux-pro-ultra"].includes(state.req.model)) {
        return ["1:1", "16:9", "9:16", "4:5", "5:4"]
      } else if (state.req.model.includes("imagen")) {
        return ["1:1", "9:16", "16:9", "3:4", "4:3"]
      } else if (state.req.model.includes("recraft") || state.req.model.includes("photon")) {
        return ["1:1", "9:16", "16:9", "3:4", "4:3", "9:21", "21:9"]
      } else return availableAspectRatios
    },
    selectedModelPrice(state) {
      return imageModelDatas.find((m) => m.name === state.req.model)?.pointsCost || 0
    },
    anyLoading(state) {
      return Object.values(state.loading).some((v) => v)
    },
    totalCost(state) {
      const modelCost = imageModelDatas.find((m) => m.name === state.req.model)?.pointsCost
      if (!modelCost) return 0
      return state.req.quantity * modelCost
    },
  },
  actions: {
    async loadCustomModel(modelId: string) {
      const response = await modelsGetModel({ id: modelId })
      const customModel = response.data
      this.customModel = customModel
      this.req.customModelName = customModel.name
      this.req.customModelId = customModel.id
    },
    setReq(req: Partial<CreateImageRequestWithCustomModel>) {
      console.log("setReq in createCardStore")
      this.req = { ...this.req, ...req }
      if (!req.customModelId) {
        this.customModel = null
        this.req.customModelName = undefined
      }
      if (req.customModelId) void this.loadCustomModel(req.customModelId)
      LocalStorage.set("req", this.req)
    },
    updatePrivateMode(val: boolean) {
      this.privateMode = val
      this.req.public = !val
    },
    pickModel() {
      void this.router.push({ name: "create", params: { tab: "faceForge" } })
    },
    async newPrompt() {
      this.loading.new = true
      const response = await createRandomPrompt({})
      this.req.prompt = response.data || this.req.prompt
      if (this.req.seed) {
        this.req.seed = undefined
        this.req.quantity = 4
      }
      this.loading.new = false
      await this.userAuth.loadUserData()
      umami.track("newPrompt")
    },
    async improvePrompt() {
      this.loading.improve = true
      const response = await createImprovePrompt({ prompt: this.req.prompt })
      this.req.prompt = response.data || this.req.prompt
      this.loading.improve = false
      await this.userAuth.loadUserData()
      umami.track("improvePrompt")
    },
    async randomizePrompt() {
      this.loading.randomize = true
      const existingPrompt = this.req.prompt.length > 0 ? this.req.prompt : undefined
      const response = await createRandomPrompt({ theme: existingPrompt })
      this.req.prompt = response.data || this.req.prompt
      this.loading.randomize = false
      await this.userAuth.loadUserData()
      umami.track("randomizePrompt")
    },
    async createImage() {
      this.loading.create = true
      LocalStorage.set("req", this.req)
      if (this.customModel) {
        this.req.customModelId = this.customModel.id
        this.req.customModelName = this.customModel.name
        this.req.model = "custom"
      }
      if (typeof this.req.seed != "number") this.req.seed = undefined
      if (this.req.model == "custom" && !this.req.customModelId) this.req.model = "flux-dev"
      console.log("req", this.req)
      await this.creations.generateImage(toObject(this.req)).catch(catchErr)
      this.loading.create = false
      void this.userAuth.loadUserData()
      umami.track("createImage")
    },
  },
})
