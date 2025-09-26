// stores/createImageStore.ts — Composition API + factory reset
import { defineStore } from "pinia"
import { ref, computed, reactive, watch } from "vue"
import { LocalStorage, Notify } from "quasar"
import { useRouter } from "vue-router"
import { aspectRatios, imageModels, type AspectRatio, type ImageModel } from "lib/imageModels"
import { toObject, catchErr } from "lib/util"
import { useCreateSession } from "stores/createSessionStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import * as modelsStore from "src/stores/modelsStore"
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
  // New: allow mixing existing creation image IDs
  startImageIds?: string[]
}

// Types used by both initState and the store
type RandomizerState = {
  enabled: boolean
  mode: "random" | "manual"
  picksCount: number
  maxBudget: number
  excludeExpensive: boolean
  manualSelection: ImageModel[]
  // New: support selecting multiple custom models by id
  manualCustomIds: string[]
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
    // Model randomizer state (persisted separately)
    randomizer: ((): RandomizerState => {
      const saved = LocalStorage.getItem("modelRandomizer") as Partial<RandomizerState> | null
      return {
        enabled: saved?.enabled ?? true,
        mode: saved?.mode ?? "random",
        picksCount: saved?.picksCount ?? 3, // default to 3 images
        maxBudget: saved?.maxBudget ?? 30, // default to 30 points budget
        excludeExpensive: saved?.excludeExpensive ?? true,
        manualSelection: saved?.manualSelection ?? [],
        manualCustomIds: (saved as any)?.manualCustomIds ?? [],
      }
    })(),
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

  const privateTaxRate = computed(() => {
    const tax = prices.privateTax
    if (typeof tax === "number" && Number.isFinite(tax)) return Math.max(0, tax) / 100
    return 0.05
  })

  const privatePremiumPerImage = computed(() => {
    const premium = selectedModelPrice.value * privateTaxRate.value
    return Math.ceil(premium)
  })

  const quantity = computed(() => 1)

  const publicTotalCost = computed(() => selectedModelPrice.value * quantity.value)

  const privatePremiumTotal = computed(() => Math.ceil(publicTotalCost.value * privateTaxRate.value))

  const privateTotalCost = computed(() => publicTotalCost.value + privatePremiumTotal.value)

  const totalCost = computed(() => (state.req.public === false ? privateTotalCost.value : publicTotalCost.value))

  // --- Randomizer helpers ---

  const COMMON_SAFE_RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1"]

  function saveRandomizer() {
    LocalStorage.set("modelRandomizer", toObject(state.randomizer))
  }

  function priceForModel(model: ImageModel): number {
    // Map custom model price via selected type (handled in selectedModelPrice for single)
    const p = prices.image.model[model as keyof typeof prices.image.model]
    return typeof p === "number" ? p : 10
  }

  function isExpensive(model: ImageModel): boolean {
    const p = priceForModel(model)
    return p >= 18 // heuristic: >= 18 points considered expensive by default
  }

  function candidateModels(): ImageModel[] {
    // Exclude "custom" from random picks since it requires customModelId
    // Keep only models we actually support on image creation forms
    const base: ImageModel[] = imageModels.filter((m) => m !== "custom")
    let list = state.randomizer.excludeExpensive ? base.filter((m) => !isExpensive(m)) : base
    // Safety: never return empty; if all filtered out, fall back to base
    if (list.length === 0) list = base
    return list
  }

  function pickRandom<T>(arr: T[], count: number): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      //@ts-ignore
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, Math.max(0, Math.min(count, copy.length)))
  }

  function pickModelsForBudget(models: ImageModel[], maxBudget: number, maxCount: number): ImageModel[] {
    // Try a few random shuffles to find a good subset under budget
    const tries = 12
    let best: { models: ImageModel[]; cost: number } = { models: [], cost: 0 }
    for (let t = 0; t < tries; t++) {
      const shuffled = pickRandom(models, models.length)
      const picked: ImageModel[] = []
      let cost = 0
      for (const m of shuffled) {
        const c = priceForModel(m)
        if (picked.length < maxCount && cost + c <= maxBudget) {
          picked.push(m)
          cost += c
        }
      }
      if (picked.length > best.models.length || (picked.length === best.models.length && cost > best.cost)) {
        best = { models: picked, cost }
      }
      if (best.models.length >= maxCount) break
    }
    if (best.models.length === 0) {
      // If even the cheapest single model exceeds budget, pick the cheapest one
      const cheapest = [...models].sort((a, b) => priceForModel(a) - priceForModel(b))[0]
      if (cheapest) return [cheapest]
    }
    return best.models
  }

  function resolveMultiModels(): ImageModel[] {
    if (!state.randomizer.enabled) return [state.req.model]
    if (state.randomizer.mode === "manual") {
      const manual = state.randomizer.manualSelection.filter((m) => m !== "custom") as ImageModel[]
      // In manual mode, use exactly the selected base models. It's valid for this to be empty
      // when only custom models are chosen; callers will handle adding custom requests.
      return manual
    }
    // Random mode
    const candidates = candidateModels()
    return pickModelsForBudget(candidates, state.randomizer.maxBudget, state.randomizer.picksCount)
  }

  const publicTotalCostMulti = computed(() => {
    if (!state.randomizer.enabled) return publicTotalCost.value
    const models = resolveMultiModels()
    let sum = models.reduce((acc, m) => acc + priceForModel(m), 0)
    // Add cost for any selected custom models in manual mode
    const customIds = state.randomizer.manualCustomIds || []
    if (customIds.length > 0) {
      // Price custom models using their base model type plus custom surcharge
      const baseCustomCharge = prices.forge.customModelCharge || 0
      for (const id of customIds) {
        // Try to infer modelType from cached stores if available
        let baseModel: ImageModel = "flux-dev"
        const found = (modelsStore.models.userModels || []).find((m: any) => m.id === id) ||
          (modelsStore.models.custom || []).find((m: any) => m.id === id)
        if (found?.modelType) {
          switch (String(found.modelType)) {
            case "fluxPro":
              baseModel = "flux-pro" as ImageModel
              break
            case "fluxProUltra":
              baseModel = "flux-pro-ultra" as ImageModel
              break
            case "fluxDev":
            default:
              baseModel = "flux-dev" as ImageModel
          }
        }
        sum += priceForModel(baseModel) + baseCustomCharge
      }
    }
    return sum
  })

  const privateTotalCostMulti = computed(() => {
    if (!state.randomizer.enabled) return privateTotalCost.value
    const base = publicTotalCostMulti.value
    const premium = Math.ceil(base * privateTaxRate.value)
    return base + premium
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
    if (state.req.model === "custom" && !state.req.customModelId) {
      state.loading.create = false
      Notify.create({
        type: "warning",
        message: "Select a custom model before creating",
        position: "top",
      })
      return
    }

    // Decide models for this creation
    const modelsForThisRun = resolveMultiModels()
    // Use requested aspect ratio by default; only coerce when mixing models
    let aspect: AspectRatio | undefined = state.req.aspectRatio as AspectRatio | undefined
    const mixingModels = modelsForThisRun.length > 1
    if (mixingModels) {
      // When generating across multiple models, restrict to common safe ratios
      if (!aspect || !COMMON_SAFE_RATIOS.includes(aspect)) aspect = "1:1"
    }
    // Build batch request payloads (image variant, one per model)
    const requests = modelsForThisRun.map((m) => ({
      prompt: state.req.prompt,
      negativePrompt: undefined as string | undefined,
      quantity: 1,
      seed: state.req.seed,
      model: m,
      public: state.req.public,
      aspectRatio: m === "nano-banana" ? (undefined as any) : (aspect as any),
      customModelId: m === "custom" ? state.req.customModelId : undefined,
      uploadedStartImageIds: state.req.uploadedStartImageIds,
      startImageIds: state.req.startImageIds,
    }))

    // Also queue any explicitly selected custom models when in manual multi mode
    if (state.randomizer.enabled && state.randomizer.mode === "manual" && (state.randomizer.manualCustomIds?.length || 0) > 0) {
      for (const id of state.randomizer.manualCustomIds) {
        requests.push({
          prompt: state.req.prompt,
          negativePrompt: undefined as string | undefined,
          quantity: 1,
          seed: state.req.seed,
          model: "custom" as ImageModel,
          public: state.req.public,
          aspectRatio: aspect as any,
          customModelId: id,
          uploadedStartImageIds: state.req.uploadedStartImageIds,
          startImageIds: state.req.startImageIds,
        })
      }
    }

    let batchId: string | null = null
    try {
      const res = await createQueueAsyncBatch({ requests })
      batchId = res.data?.batchId || null
    } catch (err) {
      catchErr(err)
    } finally {
      // Do not block the form – allow queuing more while polling runs in background
      state.loading.create = false
    }

    // Immediately add placeholder tiles so users see progress while the batch runs
    const qty = Math.max(1, requests.length)
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
                const removeCount = Math.min(state.pendingPlaceholders.length, reqData.imageIds?.length || 0)
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
              message: failed ? "Some images failed to render" : "Your image is ready",
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
      // If model is not custom, clear any lingering custom model metadata
      if (state.req.model !== "custom") {
        state.customModel = null
        state.req.customModelId = undefined
        state.req.customModelName = undefined
      }
      // If aspect ratio is empty and the model supports selection, default to 16:9 (or first option)
      if (!state.req.aspectRatio) {
        // Keep undefined for models where UI disables selection (handled in the form)
        if (state.req.model !== "nano-banana") {
          ;(state.req.aspectRatio as any) = (opts.includes("16:9") ? "16:9" : opts[0]) as AspectRatio
        }
        return
      }
      // If current value is not available for the selected model, coerce to a valid option
      if (!opts.includes(state.req.aspectRatio)) {
        ;(state.req.aspectRatio as any) = (opts.includes("16:9") ? "16:9" : opts[0]) as AspectRatio
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
    privateTaxRate,
    privatePremiumPerImage,
    privatePremiumTotal,
    publicTotalCost,
    privateTotalCost,
    totalCost,
    // multi-model costs for UI when randomizer is enabled
    publicTotalCostMulti,
    privateTotalCostMulti,
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
    saveRandomizer,
    priceForModel,
  }
})
