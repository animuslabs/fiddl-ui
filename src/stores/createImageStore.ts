// stores/createImageStore.ts — Composition API + factory reset
import { defineStore } from "pinia"
import { ref, computed, reactive, watch } from "vue"
import { LocalStorage } from "quasar"
import { useRouter } from "vue-router"
import { aspectRatios, imageModels, type AspectRatio, type ImageModel } from "lib/imageModels"
import { toObject, catchErr } from "lib/util"
import { useCreateSession } from "stores/createSessionStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useUserAuth } from "src/stores/userAuth"
import { createImprovePrompt, createRandomPrompt, modelsGetCustomModel } from "lib/orval"
import umami from "lib/umami"
import type { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import type { CustomModel } from "lib/api"
import { useLoadingStates } from "lib/composables/useLoadingStates"
import { prices } from "src/stores/pricesStore"
const defaultImageRequest: CreateImageRequest = {
  prompt: "",
  model: "flux-dev",
  aspectRatio: "1:1",
  public: true,
  quantity: 1,
}

export type CreateImageRequestWithCustomModel = CreateImageRequest & {
  customModelName?: string
  customModelId?: string
}

const availableAspectRatios = Object.freeze(aspectRatios)

function initState() {
  const loadedRequest = LocalStorage.getItem("req") as CreateImageRequestWithCustomModel | null
  const { anyLoading, loading } = useLoadingStates(["new", "randomize", "improve", "create"])
  return {
    req: loadedRequest ?? { ...defaultImageRequest },
    privateMode: false,
    turnstileValidated: true,
    loading,
    anyLoading,
    customModel: null as CustomModel | null,
  }
}

export const useCreateImageStore = defineStore("createImageStore", () => {
  const state = reactive(initState())
  const createSession = useCreateSession()
  const creations = useImageCreations()
  const userAuth = useUserAuth()
  const router = useRouter()

  const availableAspectRatiosComputed = computed(() => {
    const model = state.req.model
    if (model.includes("dall") || model.includes("gpt-image")) return ["1:1", "16:9", "9:16"]
    if (["flux-dev", "flux-pro", "flux-pro-ultra", "custom"].includes(model)) return ["1:1", "16:9", "9:16", "4:5", "5:4"]
    if (model.includes("imagen")) return ["1:1", "9:16", "16:9", "3:4", "4:3"]
    if (model.includes("recraft")) return ["1:1", "9:16", "16:9", "3:4", "4:3"]
    if (model.includes("photon")) return ["1:1", "3:4", "4:3", "9:16", "16:9", "9:21", "21:9"]
    if (model.includes("seedream")) return ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"]
    return availableAspectRatios
  })

  const selectedModelPrice = computed(() => {
    let modelName: ImageModel = state.req.model
    console.log(state.customModel?.modelType)
    if (modelName === "custom" && state.customModel?.modelType) {
      switch (state.customModel.modelType) {
        case "fluxDev":
          modelName = "flux-dev"
          break
        case "fluxPro":
          modelName = "flux-pro"
          break
        case "fluxProUltra":
          modelName = "flux-pro-ultra"
          break
        default:
          modelName = "flux-dev"
      }
    }
    let baseCost = prices.image.model[modelName] || 10
    if (state.req.model == "custom") baseCost += prices.forge.customModelCharge
    return baseCost
  })

  const totalCost = computed(() => {
    const baseCost = selectedModelPrice
    return baseCost.value * state.req.quantity
  })

  const anyLoading = computed(() => Object.values(state.loading).some(Boolean))

  async function loadCustomModel(modelId: string) {
    const response = await modelsGetCustomModel({ id: modelId })
    state.customModel = response.data
    state.req.customModelName = response.data.name
    state.req.customModelId = response.data.id
  }

  function setReq(req: Partial<CreateImageRequestWithCustomModel>) {
    Object.assign(state.req, req)
    if (!req.customModelId) {
      state.customModel = null
      state.req.customModelName = undefined
    }
    if (req.customModelId) void loadCustomModel(req.customModelId)
    LocalStorage.set("req", state.req)
  }

  function updatePrivateMode(val: boolean) {
    state.privateMode = val
    state.req.public = !val
  }

  function pickModel() {
    void router.push({ name: "create", params: { tab: "faceForge" } })
  }

  async function newPrompt() {
    state.loading.new = true
    const res = await createRandomPrompt({ type: "image" })
    state.req.prompt = res.data || state.req.prompt
    if (state.req.seed) {
      state.req.seed = undefined
      state.req.quantity = 4
    }
    state.loading.new = false
    await userAuth.loadUserData()
    umami.track("newPrompt")
  }

  async function improvePrompt() {
    state.loading.improve = true
    const res = await createImprovePrompt({ prompt: state.req.prompt, type: "image" })
    state.req.prompt = res.data || state.req.prompt
    state.loading.improve = false
    await userAuth.loadUserData()
    umami.track("improvePrompt")
  }

  async function randomizePrompt() {
    state.loading.randomize = true
    const theme = state.req.prompt.length > 0 ? state.req.prompt : undefined
    const res = await createRandomPrompt({ theme, type: "image" })
    state.req.prompt = res.data || state.req.prompt
    state.loading.randomize = false
    await userAuth.loadUserData()
    umami.track("randomizePrompt")
  }

  async function createImage() {
    state.loading.create = true
    LocalStorage.set("req", state.req)
    if (typeof state.req.seed !== "number") state.req.seed = undefined
    if (state.req.model === "custom" && !state.req.customModelId) state.req.model = "flux-dev"
    await creations.generateImage(toObject(state.req)).catch(catchErr)
    state.loading.create = false
    await userAuth.loadUserData()
    umami.track("createImage")
  }

  function reset() {
    const fresh = initState()
    for (const key in fresh) {
      if (typeof fresh[key] === "object" && fresh[key] !== null) Object.assign(state[key], fresh[key])
      else state[key] = fresh[key]
    }
  }

  watch(
    () => state.req.model,
    () => {
      console.log("model watch triggered")
      if (!availableAspectRatiosComputed.value?.includes(state.req.aspectRatio || "16:9")) (state.req.aspectRatio as any) = availableAspectRatiosComputed.value[0] || ("16:9" as AspectRatio)
    },
  )

  return {
    state,
    createSession,
    creations,
    userAuth,
    availableModels: imageModels,
    availableAspectRatios: availableAspectRatiosComputed,
    selectedModelPrice,
    totalCost,
    anyLoading,
    loadCustomModel,
    setReq,
    updatePrivateMode,
    pickModel,
    newPrompt,
    improvePrompt,
    randomizePrompt,
    createImage,
    reset,
  }
})
