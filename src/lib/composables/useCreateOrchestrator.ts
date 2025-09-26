// lib/composables/useCreateOrchestrator.ts
import { computed, onMounted, watch, nextTick } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Dialog, useQuasar } from "quasar"
import { useCreateImageStore, type CreateImageRequestWithCustomModel } from "src/stores/createImageStore"
import InputImageQuickEdit from "src/components/dialogs/InputImageQuickEdit.vue"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { useCreateContextStore } from "src/stores/createContextStore"
import { createCardStore } from "src/stores/createCardStore"
import { useUserAuth } from "src/stores/userAuth"
import { creationsGetCreationData, modelsGetCustomModel } from "src/lib/orval"
import { getCreationRequest, throwErr } from "lib/util"
import type { CreateImageRequest, CreateVideoRequest } from "fiddl-server/dist/lib/types/serverTypes"
import type { MediaType } from "lib/types"

type EditType = "prompt" | "all" | "video"

function parseBool(input: unknown): boolean | undefined {
  if (input === undefined || input === null) return undefined
  if (typeof input === "boolean") return input
  const str = String(input).toLowerCase()
  if (str === "1" || str === "true" || str === "yes") return true
  if (str === "0" || str === "false" || str === "no") return false
  return undefined
}

export function useCreateOrchestrator() {
  const route = useRoute()
  const router = useRouter()
  const $q = useQuasar()

  const imgCreate = useCreateImageStore()
  const vidCreate = useCreateVideoStore()
  const imgCreations = useImageCreations()
  const vidCreations = useVideoCreations()
  const ctx = useCreateContextStore()
  const auth = useUserAuth()

  const activeTab = computed<MediaType>(() => {
    const t = route.params?.activeTab as MediaType | undefined
    return t === "video" ? "video" : "image"
  })

  async function applyRequestFromMediaId(mediaId: string, mediaType: MediaType | undefined, editType: EditType | undefined) {
    if (!mediaType) throwErr("missing media type")
    const { data: mediaData } = await creationsGetCreationData({
      videoId: mediaType === "video" ? mediaId : undefined,
      imageId: mediaType === "image" ? mediaId : undefined,
    })
    const request = await getCreationRequest(mediaData.requestId, mediaType)
    let req: Partial<CreateImageRequest | CreateVideoRequest>
    if (editType === "prompt") {
      req = { prompt: request.prompt }
    } else if (editType === "all") {
      req = { ...(request as any), quantity: 1 }
    } else if (editType === "video") {
      req = {
        startImageId: mediaId,
        uploadedStartImageId: undefined,
        model: "seedance-pro",
        prompt: "",
      }
    } else {
      throwErr("invalid edit request")
      return
    }

    // Validate custom model if present
    if ((req as any).model === "custom" && (req as any).customModelId) {
      const modelData = await modelsGetCustomModel({ id: (req as any).customModelId }).catch(console.error)
      const customModel = modelData?.data
      if (!customModel) {
        ;(req as any).customModelId = undefined
        ;(req as any).model = "flux-dev"
        Dialog.create({
          message: "Custom model is private, using flux-dev model instead",
          color: "negative",
          persistent: true,
        })
      }
    }

    // Derive tab: video editType forces video, otherwise use mediaType
    const tab = editType === "video" ? "video" : mediaType
    createCardStore.activeTab = tab
    ctx.setActiveTab(tab)

    if (tab === "image") imgCreate.setReq(req as Partial<CreateImageRequest>)
    else vidCreate.setReq(req as Partial<CreateVideoRequest>)

    // If already on the Create page on mobile, ensure the create card opens
    if ($q.screen.lt.md) ctx.state.createMode = true

    Dialog.create({
      title: "Image Parameters Applied",
      message: "The prompt, model, and seed of the image have been added to the create panel. Make small changes to the prompt or seed to get similar images.",
    }).onDismiss(async () => {
      const q = { ...route.query }
      delete q.mediaId
      delete q.type
      delete q.editType
      await router.replace({ query: q })
    })
  }

  async function applyRequestFromEncoded(encodedRequestData: string) {
    const decoded = JSON.parse(decodeURIComponent(encodedRequestData))
    if (activeTab.value === "image") imgCreate.setReq(decoded as Partial<CreateImageRequest>)
    else vidCreate.setReq(decoded as Partial<CreateVideoRequest>)

    // Ensure the create card opens on mobile when applying params in-place
    if ($q.screen.lt.md) ctx.state.createMode = true

    Dialog.create({
      title: "Image Parameters Applied",
      message: "The create panel has been updated with the details of the image request.",
    }).onDismiss(async () => {
      const q = { ...route.query }
      delete q.requestData
      await router.replace({ query: q })
    })
  }

  async function applyInputImageFromMediaId(inputImageId: string) {
    // Force image tab context
    const tab: MediaType = "image"
    createCardStore.activeTab = tab
    ctx.setActiveTab(tab)

    // Optional model preselection via query
    // Optional model preselection via query; default to nano-banana for input-image flow
    const modelParam = typeof route.query.model === "string" ? (route.query.model as string) : 'nano-banana'

    // Apply input image and optionally model to image create store
    // Preserve any existing selections and merge uniquely
    const currentStart = imgCreate.state.req.startImageIds || []
    const currentUploaded = imgCreate.state.req.uploadedStartImageIds || []
    const startSet = new Set(currentStart)
    const uploadedSet = new Set(currentUploaded)
    if (!startSet.has(inputImageId) && !uploadedSet.has(inputImageId)) startSet.add(inputImageId)

    const req: Partial<CreateImageRequestWithCustomModel> = {
      startImageIds: Array.from(startSet),
      uploadedStartImageIds: Array.from(uploadedSet),
    }
    if (modelParam) (req as any).model = modelParam
    imgCreate.setReq(req)

    // If already on the Create page on mobile, ensure the create card opens
    if ($q.screen.lt.md) ctx.state.createMode = true

    await nextTick()
    // In some navigations from other pages, immediate dialog creation
    // can be interrupted by route transition/overlay teardown.
    // Defer slightly to ensure the page is fully settled.
    window.setTimeout(() => {
      Dialog.create({
        component: InputImageQuickEdit,
        componentProps: { imageId: inputImageId },
      }).onDismiss(async () => {
        void (async () => {
          const q = { ...route.query }
          delete q.inputImageId
          await router.replace({ query: q })
        })()
      })
    }, 120)
    // keep model if present
  }

  function bindDynamicModelAndFilters() {
    const dyn = parseBool(route.query.dynamicModel)
    const currentTab = activeTab.value

    if (currentTab === "image") {
      if (dyn !== undefined) imgCreations.dynamicModel = dyn
      if (imgCreations.dynamicModel) {
        imgCreations.filter.model = imgCreate.state.req.model as any
        if (imgCreate.state.req.model === "custom") {
          imgCreations.filter.customModelId = imgCreate.state.req.customModelId
          ;(imgCreations as any).customModelId = imgCreate.state.req.customModelId || null
        } else {
          imgCreations.filter.customModelId = undefined
          ;(imgCreations as any).customModelId = null
        }
      } else {
        imgCreations.filter.model = undefined
        imgCreations.filter.customModelId = undefined
        ;(imgCreations as any).customModelId = null
      }
    } else {
      if (dyn !== undefined) vidCreations.dynamicModel = dyn
      if (vidCreations.dynamicModel) {
        vidCreations.filter.model = vidCreate.state.req.model as any
      } else {
        vidCreations.filter.model = undefined
      }
    }
  }

  async function initialLoadIfNeeded() {
    const userId = auth.userId || undefined
    const tab = activeTab.value
    if (tab === "image") {
      imgCreations.searchCreations(userId)
      ctx.setHasLoaded("image", true)
    } else {
      vidCreations.searchCreations(userId)
      ctx.setHasLoaded("video", true)
    }
  }

  function applyUIContext() {
    // Active tab
    createCardStore.activeTab = activeTab.value
    ctx.setActiveTab(activeTab.value)

    // Create mode from query or responsive default
    const requestedCreateMode = parseBool(route.query.createMode)
    const suppressCreateModal = typeof route.query.noCreateModal !== "undefined"
    if (suppressCreateModal) ctx.state.createMode = false
    else if (requestedCreateMode !== undefined) ctx.state.createMode = requestedCreateMode
    else ctx.state.createMode = $q.screen.lt.md

    // Persist/restore grid mode handled by store; nothing to do here
  }

  async function initFromRoute() {
    const initKey = route.fullPath
    if (ctx.state.lastInitKey === initKey) return
    ctx.setLastInitKey(initKey)

    applyUIContext()

    const mediaId = typeof route.query.mediaId === "string" ? route.query.mediaId : undefined
    const inputImageId = typeof route.query.inputImageId === "string" ? route.query.inputImageId : undefined
    const mediaType = (route.query.type as MediaType | undefined) || undefined
    const editType = (route.query.editType as EditType | undefined) || undefined
    const encodedRequestData = typeof route.query.requestData === "string" ? route.query.requestData : undefined

    if (inputImageId) {
      await applyInputImageFromMediaId(inputImageId)
    } else if (mediaId) {
      await applyRequestFromMediaId(mediaId, mediaType, editType)
    } else if (encodedRequestData) {
      await applyRequestFromEncoded(encodedRequestData)
    } else {
      // Route-level preselection for model/customModelId/customModelName
      const modelParam = typeof route.query.model === "string" ? (route.query.model as string) : undefined
      const customModelIdParam = typeof route.query.customModelId === "string" ? (route.query.customModelId as string) : undefined
      const customModelNameParam = typeof route.query.customModelName === "string" ? (route.query.customModelName as string) : undefined

      if (modelParam) {
        if (activeTab.value === "image") {
          imgCreate.setReq({
            model: modelParam as any,
            customModelId: customModelIdParam,
            customModelName: customModelNameParam,
          } as Partial<CreateImageRequest>)
        } else {
          vidCreate.setReq({
            model: modelParam as any,
          } as Partial<CreateVideoRequest>)
        }
      }
    }

    // Bind filters AFTER request is applied
    bindDynamicModelAndFilters()

    // Kick initial load (or refresh) for the active tab
    await initialLoadIfNeeded()

    ctx.setInitialized(true)
  }

  onMounted(() => {
    void initFromRoute()
  })

  watch(
    () => route.fullPath,
    async () => {
      void initFromRoute()
    },
  )

  return {
    initFromRoute,
    initialized: computed(() => ctx.state.initialized),
    activeTab,
  }
}
