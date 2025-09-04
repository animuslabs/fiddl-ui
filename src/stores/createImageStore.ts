// stores/createImageStore.ts — Composition API + factory reset
import { defineStore } from "pinia"
import { ref, computed, reactive, watch } from "vue"
import { LocalStorage, Notify } from "quasar"
import { useRouter } from "vue-router"
import { aspectRatios, imageModels, type AspectRatio, type ImageModel } from "lib/imageModels"
import { toObject, catchErr } from "lib/util"
import { useCreateSession } from "stores/createSessionStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useUserAuth } from "src/stores/userAuth"
import { createImprovePrompt, createRandomPrompt, modelsGetCustomModel, createQueueAsyncBatch, createBatchStatus, creationsGetImageRequest } from "lib/orval"
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
  // Allow optional input images list for supported models
  uploadedStartImageIds?: string[]
}

const availableAspectRatios = Object.freeze(aspectRatios)

function initState() {
  const loadedRequest = LocalStorage.getItem("req") as CreateImageRequestWithCustomModel | null
  if (loadedRequest?.customModelId) {
    void modelsGetCustomModel({ id: loadedRequest.customModelId }).then((response) => {
      const store = useCreateImageStore()
      store.state.customModel = response.data
      store.state.req.customModelName = response.data.name
      store.state.req.customModelId = response.data.id
    })
  }

  const { anyLoading, loading } = useLoadingStates(["new", "randomize", "improve", "create"])
  return {
    req: loadedRequest ?? { ...defaultImageRequest },
    privateMode: false,
    turnstileValidated: true,
    loading,
    anyLoading,
    customModel: null as CustomModel | null,
    // Pending placeholder image IDs to render loading tiles in galleries
    pendingPlaceholders: [] as string[],
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
    // Immediately persist request and kick off async batch without blocking UI
    state.loading.create = true
    LocalStorage.set("req", state.req)
    if (typeof state.req.seed !== "number") state.req.seed = undefined
    if (state.req.model === "custom" && !state.req.customModelId) state.req.model = "flux-dev"

    // Build batch request payload (images variant)
    const requestPayload = {
      prompt: state.req.prompt,
      negativePrompt: undefined as string | undefined,
      quantity: state.req.quantity,
      seed: state.req.seed,
      model: state.req.model,
      public: state.req.public,
      aspectRatio: state.req.aspectRatio,
      customModelId: state.req.customModelId,
      uploadedStartImageIds: state.req.uploadedStartImageIds,
    }

    let batchId: string | null = null
    try {
      const res = await createQueueAsyncBatch({ requests: [requestPayload] })
      batchId = res.data?.batchId || null
    } catch (err) {
      catchErr(err)
    } finally {
      // Do not block the form – allow queuing more while polling runs in background
      state.loading.create = false
    }

    // Immediately add placeholder tiles so users see progress while the batch runs
    const qty = Math.max(1, Number(state.req.quantity || 1))
    const stamp = Date.now()
    const placeholders = Array.from({ length: qty }, (_, i) => `pending-${stamp}-${Math.random().toString(36).slice(2, 8)}-${i}`)
    // Add to the front so placeholders appear first in galleries
    state.pendingPlaceholders.unshift(...placeholders)

    // Track points usage event
    await userAuth.loadUserData()
    umami.track("createImage")

    if (!batchId) return

    // Poll batch status every 2s and push finished jobs into the creations store as soon as they are ready
    const processedReqs = new Set<string>()
    // Track jobs we've already surfaced errors for (avoid duplicate popups)
    const erroredNotified = new Set<string>()
    const pollMs = 2000
    // Interval handle for polling (needs to be declared before first pollOnce run)
    let pollTimer: number | null = null

    async function pollOnce() {
      try {
        const { data: batch } = await createBatchStatus({ batchId: batchId! })
        // Null indicates server lost track or was restarted; stop polling and hard-reload to recover
        if (!batch) {
          if (pollTimer) window.clearInterval(pollTimer)
          window.location.reload()
          return
        }

        // Handle per-job state
        for (const job of batch.jobs) {
          if (job.type !== "image") continue

          // Surface failures immediately with their server-provided messages
          if (job.status === "failed" && !erroredNotified.has(job.id)) {
            const details = (job.errors || []).filter(Boolean)
            const message = details.length ? details.join("\n• ") : "Image generation failed"
            catchErr(new Error(message))
            erroredNotified.add(job.id)
          }

          // Push finished image jobs immediately to the gallery
          if (job.status === "finished") {
            const reqId = job.imageRequestId
            if (!reqId || processedReqs.has(reqId)) continue
            processedReqs.add(reqId)

            try {
              const { data: reqData } = await creationsGetImageRequest({ imageRequestId: reqId })
              if (reqData) {
                creations.addItemToFront({
                  ...reqData,
                  createdAt: new Date(reqData.createdAt),
                } as any)
                // Remove as many placeholders as the finished images we just added
                const removeCount = Math.min(state.pendingPlaceholders.length, (reqData.imageIds?.length || 0))
                if (removeCount > 0) state.pendingPlaceholders.splice(0, removeCount)
              }
            } catch (e) {
              // ignore fetch failure and continue polling
            }
          }
        }

        // Determine completion
        const allDone = batch.counts.finished + batch.counts.failed >= batch.counts.total
        if (allDone || batch.status === "completed" || batch.status === "error") {
          const failed = batch.counts.failed > 0

          // If the whole batch errored and we haven't shown any per-job error, summarize all errors
          if (batch.status === "error") {
            const allErrors = (batch.jobs || [])
              .filter((j) => j.type === "image" && (j.errors?.length || 0) > 0)
              .flatMap((j) => j.errors || [])
              .filter(Boolean)
            if (allErrors.length) {
              catchErr(new Error(allErrors.join("\n• ")))
            }
          }

          if (processedReqs.size > 0 || failed) {
            Notify.create({
              type: failed ? "warning" : "positive",
              message: failed ? "Some images failed to render" : "Your images are ready",
              position: "top",
            })
          }
          // On completion ensure no orphan placeholders remain
          if (state.pendingPlaceholders.length > 0) {
            state.pendingPlaceholders.splice(0, state.pendingPlaceholders.length)
          }
          if (pollTimer) window.clearInterval(pollTimer)
        }
      } catch (e: any) {
        // If server responds with 5xx, stop polling and reload to avoid infinite loading state
        const status = e?.response?.status
        if (typeof status === "number" && status >= 500 && status < 600) {
          if (pollTimer) window.clearInterval(pollTimer)
          window.location.reload()
          return
        }
        // Swallow transient network errors; keep interval alive
      }
    }

    pollTimer = window.setInterval(pollOnce, pollMs) as unknown as number
    // Run immediately to avoid waiting 2s for the first update
    void pollOnce()
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
      const opts = availableAspectRatiosComputed.value || []
      // If aspect ratio is empty and the model supports selection, default to 16:9 (or first option)
      if (!state.req.aspectRatio) {
        // Keep undefined for models where UI disables selection (handled in the form)
        if (state.req.model !== "nano-banana") {
          (state.req.aspectRatio as any) = (opts.includes("16:9") ? "16:9" : opts[0]) as AspectRatio
        }
        return
      }
      // If current value is not available for the selected model, coerce to a valid option
      if (!opts.includes(state.req.aspectRatio)) {
        (state.req.aspectRatio as any) = (opts.includes("16:9") ? "16:9" : opts[0]) as AspectRatio
      }
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
