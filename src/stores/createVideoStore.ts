import { defineStore } from "pinia"
import { videoModelDatas, videoModels } from "lib/imageModels"
import type { CreateVideoRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { computed, reactive, watch } from "vue"
import { useLoadingStates } from "lib/composables/useLoadingStates"
import { useUserAuth } from "src/stores/userAuth"
import { createImprovePrompt, createRandomPrompt } from "lib/orval"
import umami from "lib/umami"

const getDefaultState = () => {
  const { anyLoading, loading } = useLoadingStates(["new", "randomize", "improve", "create"])
  return {
    anyLoading,
    loading,
    req: {
      anyLoading,
      loading,
      prompt: "",
      model: "veo-2",
      aspectRatio: "16:9",
      public: true,
      quantity: 1,
      duration: 5,
    } as CreateVideoRequest,
  }
}

export const useCreateVideoStore = defineStore("createVideoStore", () => {
  const state = reactive(getDefaultState())
  const userAuth = useUserAuth()

  watch(
    () => state.req.model,
    () => {
      console.log("model watch triggered")
      console.log(availableDurations, state.req.duration)
      if (!availableDurations.value?.includes(state.req.duration || 0)) state.req.duration = availableDurations.value[0] || 5
    },
  )

  function reset() {
    const fresh = getDefaultState()
    for (const key in fresh) {
      state[key] = fresh[key]
    }
  }

  const availableAspectRatios = computed(() => {
    const model = state.req.model
    if (model === "kling" || model === "veo-3") return ["16:9"]
    if (model === "seedance-pro" || model == "seedance-lite") return ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21"]
    if (model === "veo-2") return ["16:9", "9:16"]
    return []
  })

  const availableDurations = computed(() => {
    const model = state.req.model
    if (model === "veo-3") return [8]
    if (model === "kling" || model === "seedance-pro") return [5, 10]
    if (model === "veo-2") return [5, 6, 7, 8]
    return []
  })

  const selectedModelPrice = computed(() => {
    return videoModelDatas.find((m) => m.name === state.req.model)?.pointsCostPerSecond || 0
  })

  const totalCost = computed(() => {
    const duration = state.req.duration || 5
    const cost = selectedModelPrice
    return cost.value * duration * state.req.quantity
  })

  async function createVideo() {
    console.log("create video", state.req)
    // implement video creation logic here
  }

  async function newPrompt() {
    state.loading.new = true
    const res = await createRandomPrompt({ type: "video" })
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
    const res = await createImprovePrompt({ prompt: state.req.prompt, type: "video" })
    state.req.prompt = res.data || state.req.prompt
    state.loading.improve = false
    await userAuth.loadUserData()
    umami.track("improvePrompt")
  }

  async function randomizePrompt() {
    state.loading.randomize = true
    const theme = state.req.prompt.length > 0 ? state.req.prompt : undefined
    const res = await createRandomPrompt({ theme, type: "video" })
    state.req.prompt = res.data || state.req.prompt
    state.loading.randomize = false
    await userAuth.loadUserData()
    umami.track("randomizePrompt")
  }

  return {
    state,
    reset,
    availableAspectRatios,
    availableDurations,
    selectedModelPrice,
    totalCost,
    createVideo,
    newPrompt,
    improvePrompt,
    randomizePrompt,
  }
})
