import { defineStore } from "pinia"
import { aspectRatios, videoModels, type AspectRatio } from "lib/imageModels"
import { type CreateVideoRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { computed, reactive, watch } from "vue"
import { useLoadingStates } from "lib/composables/useLoadingStates"
import { useUserAuth } from "src/stores/userAuth"
import { createImprovePrompt, createRandomPrompt, createVideo } from "lib/orval"
import umami from "lib/umami"
import { catchErr, toObject } from "lib/util"
import { LocalStorage } from "quasar"
import z from "zod"
import { match } from "ts-pattern"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { prices } from "src/stores/pricesStore"

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
    uploadedStartImageId: z.string().optional(),
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
  const creations = useVideoCreations()

  watch(
    () => state.req.model,
    () => {
      console.log("model watch triggered")
      console.log(availableDurations, state.req.duration)
      if (!availableDurations.value?.includes(state.req.duration || 0)) state.req.duration = availableDurations.value[0] || 5
      if (!availableAspectRatios.value?.includes((state.req.aspectRatio as any) || ("16:9" as any))) (state.req.aspectRatio as any) = availableAspectRatios.value[0] || ("16:9" as AspectRatio)
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
    return match(state.req.model)
      .with("veo-3", () => [8])
      .with("kling", "seedance-pro", "seedance-lite", () => [5, 10])
      .with("veo-2", () => [5, 6, 7, 8])
      .exhaustive()
  })

  const selectedModelPrice = computed(() => {
    const cost = prices.video.model[state.req.model]
    return typeof cost === "number" && Number.isFinite(cost) ? cost : 0
  })

  const quantity = computed(() => 1)
  const duration = computed(() => Math.max(1, Number(state.req.duration || 5)))

  const privateTaxRate = computed(() => {
    const tax = prices.privateTax
    if (typeof tax === "number" && Number.isFinite(tax)) return Math.max(0, tax) / 100
    return 0.05
  })

  const publicTotalCost = computed(() => selectedModelPrice.value * duration.value * quantity.value)

  const privatePremiumPerItem = computed(() => {
    const perItemBase = selectedModelPrice.value * duration.value
    const premium = perItemBase * privateTaxRate.value
    return Math.ceil(premium)
  })

  const privatePremiumTotal = computed(() => Math.ceil(publicTotalCost.value * privateTaxRate.value))

  const privateTotalCost = computed(() => publicTotalCost.value + privatePremiumTotal.value)

  const totalCost = computed(() => (state.req.public === false ? privateTotalCost.value : publicTotalCost.value))

  // async function createVideoRequest() {
  //   console.log("create video", state.req)
  //   const result = await createVideo({ ...state.req })
  //   console.log(result)
  //   creations.addItem
  //   // addCre
  // }

  async function createVideoRequest() {
    state.loading.create = true
    LocalStorage.set("videoReq", state.req)
    if (typeof state.req.seed !== "number") state.req.seed = undefined
    await creations.generateVideo({ ...toObject(state.req), quantity: 1 }).catch(catchErr)
    state.loading.create = false
    await userAuth.loadUserData()
    umami.track("createImage")
  }

  async function newPrompt() {
    state.loading.new = true
    const res = await createRandomPrompt({ type: "video" })
    state.req.prompt = res.data || state.req.prompt
    if (state.req.seed) {
      state.req.seed = undefined
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
    privateTaxRate,
    privatePremiumPerItem,
    privatePremiumTotal,
    publicTotalCost,
    privateTotalCost,
    totalCost,
    createVideoRequest,
    newPrompt,
    improvePrompt,
    randomizePrompt,
  }
})
