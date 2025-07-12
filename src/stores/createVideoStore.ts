import { defineStore } from "pinia"
import { aspectRatios, videoModelDatas, videoModels, type AspectRatio } from "lib/imageModels"
import { type CreateVideoRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { computed, reactive, watch } from "vue"
import { useLoadingStates } from "lib/composables/useLoadingStates"
import { useUserAuth } from "src/stores/userAuth"
import { createImprovePrompt, createRandomPrompt, createVideo } from "lib/orval"
import umami from "lib/umami"
import { catchErr, toObject } from "lib/util"
import { LocalStorage } from "quasar"
import z from "zod"

export const createVideoRequestSchema = z
  .object({
    prompt: z.string(),
    quantity: z.number().min(1).max(5),
    seed: z.number().optional(),
    model: z.enum(videoModels),
    public: z.boolean(),
    aspectRatio: z.enum(aspectRatios),
    duration: z.number().int(),
    startImageId: z.string().optional(),
  })
  .refine(
    (data) => {
      // quantity must be 1 or undefined if seed is provided
      if (data.seed !== undefined && data.quantity !== undefined && data.quantity !== 1) return false
      else return true
    },
    { message: "quantity must be 1 if seed is provided" },
  )

const getDefaultState = () => {
  const { anyLoading, loading } = useLoadingStates(["new", "randomize", "improve", "create"])
  const savedReq = createVideoRequestSchema.safeParse(LocalStorage.getItem("videoReq"))
  let req: CreateVideoRequest
  if (savedReq.error)
    req = {
      prompt: "",
      model: "veo-2",
      aspectRatio: "16:9",
      public: true,
      quantity: 1,
      duration: 5,
    }
  else req = savedReq.data as any
  return {
    anyLoading,
    loading,
    req,
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
      if (!availableAspectRatios.value?.includes(state.req.aspectRatio || "16:9")) (state.req.aspectRatio as any) = availableAspectRatios.value[0] || ("16:9" as AspectRatio)
    },
  )

  function setReq(req: Partial<CreateVideoRequest>) {
    Object.assign(state.req, req)
  }

  watch(
    state.req,
    () => {
      console.log("req changed")
      LocalStorage.setItem("videoReq", toObject(state.req))
    },
    { deep: true },
  )

  function reset() {
    const fresh = getDefaultState()
    for (const key in fresh) {
      state[key] = fresh[key]
    }
  }

  const availableAspectRatios = computed((): AspectRatio[] => {
    const model = state.req.model
    let result: AspectRatio[] = []
    if (model === "kling" || model === "veo-3") result = ["16:9"]
    if (model === "seedance-pro" || model == "seedance-lite") result = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21"]
    if (model === "veo-2") result = ["16:9", "9:16"]
    return result
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

  async function createVideoRequest() {
    console.log("create video", state.req)
    // implement video creation logic here
    const result = await createVideo({ ...state.req })
    console.log(result)
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
    const res = await createImprovePrompt({ prompt: state.req.prompt, type: "video" }).catch(catchErr)
    if (res) state.req.prompt = res.data || state.req.prompt
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
    setReq,
    state,
    reset,
    availableAspectRatios,
    availableDurations,
    selectedModelPrice,
    totalCost,
    createVideoRequest,
    newPrompt,
    improvePrompt,
    randomizePrompt,
  }
})
