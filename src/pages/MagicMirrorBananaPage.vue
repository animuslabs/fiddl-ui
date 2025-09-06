<template lang="pug">
q-page.full-width
  .centered.q-mt-md
    h2.lobster-font Magic Mirror Fast
  .centered.q-ma-md
    p.text-primary Faster Magic Mirror: upload, pick looks, generate

  // Capture step
  div(v-if="sessionLoaded && step === 'capture'")
    .centered
      MagicMirrorCamera(
        :requiredPoints="fastRequiredPoints"
        @captured="onCaptured"
        @error="onCaptureError"
        @auth-required="onAuthRequired"
        @insufficient-points="onInsufficientPoints"
      )

  // Template selection step
  div(v-else-if="step === 'selectTemplates'")
    .centered(v-if="!templatesConfirmed")
      h4 Choose 3 looks
    // Show an indeterminate progress while images are generating
    .centered.q-mt-sm(v-if="isWaitingForImages")
      .centered.q-mb-xs
        p.text-white Generating your images...
      .centered.full-width
        q-linear-progress(indeterminate size="10px" color="primary" class="q-mt-xs" style="max-width:600px;")

    .centered.q-mt-sm(v-if="!templatesConfirmed")
      q-btn.q-mt-md(color="primary" label="Pick Looks" no-caps @click="openTemplatesDialog('initial')")

    // Preview selected templates during generation
    .centered.q-mt-sm.q-ma-md.q-pa-md(v-if="showInitialPreview || additionalLoadingTemplates.length > 0")
      MagicPreviewGrid(:templates="selectedTemplateObjs" :isDesktop="isDesktop" :gender="genderForTemplates || 'female'" :skeletonCount="0" :showSpinner="true" loadingMessage="Generating your images...")

  // Results step
  div(v-else-if="step === 'results'").relative-position.full-width
    .row.items-center.z-top.bg-blur.full-width(style="position:sticky; top:50px; margin-bottom:12px;")
      .centered.full-width
        .row.q-ml-lg
          q-btn(flat icon="refresh" label="Start again" :size="isDesktop? 'lg':'md'" no-caps @click="startAgain")
          q-btn(color="primary" square icon="group" label="More Looks" :size="isDesktop? 'lg':'md'" no-caps @click="openMoreLooks")
          q-btn(flat icon="home_repair_service" label="Advanced" :size="isDesktop? 'lg':'md'" no-caps @click="goToCreatePage")
          q-btn(flat icon="star" label="Magic Mirror Pro" :size="isDesktop? 'lg':'md'" no-caps @click="$router.push({name:'magicMirror'})")
    .centered.q-mt-sm.q-ma-md.q-pa-md(v-if="showTemplatePreview")
      MagicPreviewGrid(:templates="currentPreviewTemplates" :skeletonCount="previewSkeletonCount" :loadingMessage="previewLoadingMessage" :isDesktop="isDesktop" :gender="genderForTemplates || 'female'" :showSpinner="true")

    div(v-if="generatedImageIds.length > 0" style="width:100%;")
      .centered.full-width
        SimpleMediaGrid.q-pl-md.q-pr-md(
          :media="mediaObjects"
          :colsDesktop="3"
          :colsMobile="1"
          gap="8px"
          objectFit="contain"
          objectPosition="center"
          style="max-width:1100px;"
        )
          template(#actions="{ media }")
            .centered.bg-black.q-pa-sm.q-mb-md.q-mt-sm(style="border-radius:24px;")
              q-btn(flat size="sm" icon="share" label="Share" no-caps @click="shareImage(media.id)")
              q-btn(
                flat
                size="sm"
                icon="download"
                :label="isMobile ? 'Save to Gallery' : 'Download'"
                no-caps
                @click="isMobile ? saveToGallery(media.id) : downloadImage(media.id)"
              )
              q-btn(color="primary" flat square size="sm" icon="movie" label="Animate" no-caps @click="animateImage(media.id)")
                q-tooltip(v-if="triggeredVideoIds.includes(media.id)") Animation already triggered

  // Login dialog (shown when capture requires auth)
  q-dialog(v-model="loginDialogOpen" :maximized="!isDesktop")
    q-card(:style="isDesktop ? 'width:520px; max-width:100vw;' : 'width:100vw; max-width:100vw; height:100vh; border-radius:0;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Login to use Magic Mirror Fast
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mt-sm
          p.text-primary Please login or register to start capturing.
        PrivyLogin

  // Login prompt (post-capture)
  div(v-if="!userAuth.userProfile?.email && step != 'capture'").q-mb-lg
    .centered.q-mt-sm
      q-card(style="width:520px; max-width:100vw;")
        q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
          .centered
            h6.q-mt-none.q-mb-none Login to save your creations and receive 100 Fiddl Points
        q-separator
        q-card-section
          PrivyLogin

  // Points mini dialog (insufficient points)
  q-dialog(v-model="buyPointsDialogOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Not enough points for Magic Mirror Fast
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        p You need {{ fastRequiredPoints }} Fiddl Points to use Magic Mirror Fast (3 looks + uploads).
        p.text-secondary You have {{ availablePoints }} points. Missing {{ missingFastPoints }} points.
        .q-mt-md
          BuyPointsMini(@paymentComplete="onBuyMiniComplete")
      q-card-actions(align="right")
        q-btn(flat label="Cancel" v-close-popup)

  // Signup nudge popup after results
  q-dialog(v-model="signupNudgeOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Create an account for more
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mt-sm
          p.text-primary Save your Magic Mirror creations, earn bonus points, and unlock more features by creating an account.
        PrivyLogin

  // Templates dialog
  q-dialog(v-model="dialogOpen" :maximized="!isDesktop")
    // While we wait for gender/description, show a quick loading state
    q-card(v-if="describing || !genderForTemplates" :style="isDesktop ? 'width:520px; max-width:100vw;' : 'width:100vw; max-width:100vw; height:100vh; border-radius:0;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Preparing Looks
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .centered
          q-spinner(color="primary" size="32px")
        .centered
          p.text-secondary.q-mt-sm Analyzing your selfie…
    // Once we know the gender, show the picker immediately
    div(v-else class="tpl-dialog-body")
      PromptTemplatesPicker(
      :gender="genderForTemplates || 'female'"
      :templates="displayTemplates"
      :selected="dialogSelection"
      :gridMin="isDesktop ? 180 : 120"
      :selectionMode="'multi'"
      :selectable="true"
      :showConfirm="true"
      :confirmLabel="dialogMode === 'initial' ? 'Confirm Choices' : 'Generate'"
      @update:selected="dialogSelection = $event"
      @confirm="onDialogConfirm"
      )

  // Animate dialog
  q-dialog(v-model="animateDialogOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Animate Image
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .centered.q-mb-md
          q-img(v-if="animateDialogImageId" :src="img(animateDialogImageId, 'md')" style="max-height:220px; max-width:100%;")
        .q-mt-sm
          p Animate this image into a short video using the Kling model.
          p.q-mt-sm It costs {{ prices.video.model.kling }} points per second. Estimated cost for 5s:
            strong {{ estimatedVideoCost }} points
          p.q-mt-sm Rendering can take a few minutes. You can continue browsing Magic Mirror and check the Create page later.
      q-separator
      q-card-actions(align="right")
        q-btn(flat color="primary" label="See Video Creations" no-caps @click="goToCreateVideo")
        q-btn(color="primary" :disable="hasAnimatedSelected" :loading="animating" label="Animate now" no-caps @click="triggerAnimation")
        q-tooltip(v-if="hasAnimatedSelected") Animation was already triggered for this image

  // Floating prompt to go to video after triggering
  div(v-if="animPromptVisible" style="position:fixed; bottom:60px; left:0; right:0; z-index:1000;")
    .centered
      q-btn(
        color="primary"
        :disable="!animPromptReady"
        :label="animPromptLabel"
        icon="movie"
        unelevated
        rounded
        no-caps
        @click="goToCreateVideo"
      )
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from "vue"
import { useQuasar, Loading } from "quasar"
import { useUserAuth } from "src/stores/userAuth"
import MagicMirrorCamera from "src/components/magic/MagicMirrorCamera.vue"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import MagicPreviewGrid from "src/components/magic/MagicPreviewGrid.vue"
import PromptTemplatesPicker from "src/components/magic/PromptTemplatesPicker.vue"
import PrivyLogin from "src/components/dialogs/PrivyLogin.vue"
import BuyPointsMini from "src/components/dialogs/BuyPointsMini.vue"
import { type MediaGalleryMeta } from "src/components/MediaGallery.vue"
import SimpleMediaGrid, { type Item } from "src/components/magic/SimpleMediaGrid.vue"
import { img } from "lib/netlifyImg"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useRouter } from "vue-router"
import { type Gender, type PromptTemplate, type GenderedPromptTemplate, promptFromTemplates } from "src/lib/promptTemplates"
import { useMagicTemplateSelection } from "src/lib/magic/useMagicTemplateSelection"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"
import { catchErr } from "lib/util"
import { toCreatePage } from "lib/routeHelpers"
import { prices } from "src/stores/pricesStore"
import { createUploadImage, createQueueAsyncBatch, creationsDescribeUploadedImage, createBatchStatus } from "lib/orval"
import { uploadToPresignedPost } from "lib/api"
import { generateWebpThumbnails } from "lib/imageUtils"
import { useMagicMirrorResults } from "src/lib/magic/useMagicMirrorResults"

type Step = "init" | "capture" | "selectTemplates" | "results"

const quasar = useQuasar()
const userAuth = useUserAuth()
const imageCreations = useImageCreations()
const router = useRouter()

const step = ref<Step>("init")
const sessionLoaded = ref(false)
const loginDialogOpen = ref(false)
// Cost: 3 nano-banana images + 4 uploads
const fastRequiredPoints = computed(() => 3 * (prices.image?.model?.["nano-banana"] || 0) + 4 * (prices.image?.uploadSoloImage || 0))
const availablePoints = computed(() => userAuth.userData?.availablePoints || 0)
const buyPointsDialogOpen = ref(false)
const missingFastPoints = computed(() => Math.max(0, fastRequiredPoints.value - availablePoints.value))
// Gender handling for templates: default to female (no training-derived gender here)
const genderForTemplates = computed<Gender | null>(() => detectedGender.value)

// Template selection state via shared composable
const rawTemplates = computed<GenderedPromptTemplate[]>(() => promptTplStore.templates as unknown as GenderedPromptTemplate[])
const { dialogOpen, dialogSelection, dialogMode, selectedTemplates, templatesConfirmed, displayTemplates, templatesById, getTemplateByAnyId, selectedTemplateObjs, openTemplatesDialog } = useMagicTemplateSelection({ genderForTemplates, rawTemplates })
const generatingMore = ref(false)

// Generated results (session-scoped)
const generatedImageIds = ref<string[]>([])
// Session tracking to only show images created in this session
const sessionBaselineIds = ref<string[]>([])
const sessionCreatedIds = ref<string[]>([])
const sessionExpectedTotal = ref<number>(0)
const lastKnownIds = ref<string[]>([])
const pendingBaselineIds = ref<string[]>([])

// Upload state
const uploadedIds = ref<string[]>([])
let subjectDescription: string | undefined
const detectedGender = ref<Gender | null>(null)
const describing = ref(false)

// Progress/preview state
const additionalLoadingTemplates = ref<string[]>([])
const initialLoadingTemplates = ref<string[]>([])
const pendingNewCount = ref<number>(0)
const isWaitingForImages = ref(false)

// Polling timers
let creationsPollTimer: number | null = null
let batchStatusTimer: number | null = null

const SESSION_KEY = "mmBananaState"
const promptTplStore = usePromptTemplatesStore()

// Results actions shared via composable
const {
  shareImage,
  downloadImage,
  saveToGallery,
  animateImage,
  triggerAnimation,
  goToCreateVideo,
  animateDialogOpen,
  animateDialogImageId,
  animating,
  animPromptVisible,
  animPromptReady,
  animPromptLabel,
  estimatedVideoCost,
  hasAnimatedSelected,
  startAnimPromptCountdown,
  stopAnimPromptCountdown,
  triggeredVideoIds,
} = useMagicMirrorResults({ animatedKey: "mmBananaAnimatedVideoIds", router })

// displayTemplates, mapping, and selection provided by composable

// UI layout helpers
const templatesPreviewGridStyle = computed(() => ({
  display: "grid",
  gridTemplateColumns: isDesktop.value ? "repeat(auto-fit, minmax(140px, 1fr))" : "repeat(3, minmax(0, 1fr))",
  gap: isDesktop.value ? "10px" : "6px",
  justifyItems: "center",
  marginLeft: "auto",
  marginRight: "auto",
  width: "100%",
  maxWidth: "100%",
}))

const currentPreviewTemplates = computed<PromptTemplate[]>(() => {
  if (initialLoadingTemplates.value.length > 0) return initialLoadingTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
  if (additionalLoadingTemplates.value.length > 0) return additionalLoadingTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
  return []
})

const previewGridStyle = computed(() => ({
  display: "grid",
  gridTemplateColumns: isDesktop.value ? "repeat(auto-fit, minmax(140px, 1fr))" : "repeat(3, minmax(0, 1fr))",
  gap: isDesktop.value ? "10px" : "6px",
  justifyItems: "center",
  marginLeft: "auto",
  marginRight: "auto",
  width: "100%",
  maxWidth: "100%",
}))

const previewSkeletonCount = computed(() => Math.max(1, Math.min(3, initialLoadingTemplates.value.length || additionalLoadingTemplates.value.length || 3)))
const previewLoadingMessage = computed(() => (initialLoadingTemplates.value.length > 0 ? "Generating your looks..." : additionalLoadingTemplates.value.length > 0 ? "Rendering more looks..." : "Processing..."))

const showInitialPreview = computed(() => templatesConfirmed.value && generatedImageIds.value.length === 0)
const showTemplatePreview = computed(() => isWaitingForImages.value || pendingNewCount.value > 0 || generatingMore.value)

const isDesktop = computed(() => quasar.screen.gt.sm)
const isMobile = computed(() => quasar.platform.is.mobile)
const mediaObjects = computed<Item[]>(() => generatedImageIds.value.map((id) => ({ id, url: img(id, "lg"), type: "image" })).reverse())

// Persist/restore session state in localStorage
function saveSession() {
  const data = {
    uploadedIds: uploadedIds.value,
    selectedTemplates: selectedTemplates.value,
    templatesConfirmed: templatesConfirmed.value,
    step: step.value,
    detectedGender: detectedGender.value,
    subjectDescription,
    sessionBaselineIds: sessionBaselineIds.value,
    sessionCreatedIds: sessionCreatedIds.value,
    sessionExpectedTotal: sessionExpectedTotal.value,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
async function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      sessionLoaded.value = true
      step.value = "capture"
      return
    }
    const data = JSON.parse(raw)
    if (Array.isArray(data.uploadedIds)) uploadedIds.value = data.uploadedIds
    if (Array.isArray(data.selectedTemplates)) {
      selectedTemplates.value = data.selectedTemplates
      if (data.templatesConfirmed && (!Array.isArray(data.sessionCreatedIds) || (data.sessionExpectedTotal || 0) > (data.sessionCreatedIds?.length || 0))) {
        initialLoadingTemplates.value = data.selectedTemplates.slice()
      }
    }
    templatesConfirmed.value = !!data.templatesConfirmed
    if (data.detectedGender === "male" || data.detectedGender === "female") detectedGender.value = data.detectedGender
    if (typeof data.subjectDescription === "string") subjectDescription = data.subjectDescription
    if (Array.isArray(data.sessionBaselineIds)) sessionBaselineIds.value = data.sessionBaselineIds
    if (Array.isArray(data.sessionCreatedIds)) sessionCreatedIds.value = data.sessionCreatedIds
    if (typeof data.sessionExpectedTotal === "number") sessionExpectedTotal.value = data.sessionExpectedTotal
    const sessStep = data.step as Step | undefined
    if (sessStep) step.value = sessStep

    if (uploadedIds.value.length && !detectedGender.value) {
      // Try to recover description on refresh
      void describeFirstUploaded(uploadedIds.value[0]!)
    }
    // Restore session-created images
    if (sessionCreatedIds.value.length) {
      generatedImageIds.value = sessionCreatedIds.value.slice()
      isWaitingForImages.value = sessionCreatedIds.value.length < sessionExpectedTotal.value
    }
    if (uploadedIds.value.length && templatesConfirmed.value) startCreationsPoll()
    sessionLoaded.value = true
  } catch (e) {
    console.warn("failed to load session", e)
    step.value = "capture"
  }
}

// Camera events
async function onCaptured(blobs: Blob[]) {
  try {
    // Move straight to selection UI and start uploads in background
    step.value = "selectTemplates"
    dialogMode.value = "initial"
    dialogSelection.value = selectedTemplates.value.slice()
    describing.value = true
    dialogOpen.value = true
    void uploadBlobsBackground(blobs)
  } catch (e: any) {
    catchErr(e)
    step.value = "capture"
  }
}
function onCaptureError(reason: string) {
  // catchErr(new Error("Capture error: " + reason))
  quasar.notify({ color: "negative", message: "Capture error: " + reason })
}
function onAuthRequired() {
  loginDialogOpen.value = true
}
function onInsufficientPoints() {
  quasar.notify({ color: "negative", message: "Not enough Fiddl Points to start Magic Mirror Fast" })
  buyPointsDialogOpen.value = true
}
function onBuyMiniComplete() {
  buyPointsDialogOpen.value = false
  quasar.notify({ color: "positive", message: "Points added. Continue with Magic Mirror." })
}

// Upload blobs similar to UploadedImagesDialog
async function uploadBlobsBackground(blobs: Blob[]): Promise<void> {
  try {
    const files = blobs.map((b, i) => new File([b], `mm-${Date.now()}-${i + 1}.jpg`, { type: "image/jpeg" }))
    const compressed = await generateWebpThumbnails(files as File[], 1920, 0.98)
    const ids: string[] = []
    let described = false
    for (const c of compressed) {
      const { data } = await createUploadImage({ fileType: "image/webp" })
      await uploadToPresignedPost({ file: c, presignedPost: data.uploadUrl })
      ids.push(data.imageId)
      uploadedIds.value = ids.slice()
      saveSession()
      // Kick off description for the first uploaded image
      if (!described) {
        described = true
        void describeFirstUploaded(data.imageId)
      }
    }
    // quasar.notify({ color: "primary", message: `Uploaded ${ids.length} images` })
  } catch (e) {
    catchErr(e)
  }
}

async function describeFirstUploaded(firstId: string) {
  try {
    describing.value = true
    const { data } = await creationsDescribeUploadedImage({ imageId: firstId })
    const g = (data.subjectGender || "unknown").toString().toLowerCase()
    detectedGender.value = g === "male" || g === "female" ? (g as Gender) : "female"
    subjectDescription = data.subjectDescription || undefined
    saveSession()
  } catch (e) {
    console.warn("describeFirstUploaded failed", e)
    detectedGender.value = detectedGender.value || "female"
  } finally {
    describing.value = false
  }
}

// Templates dialog handlers
function openMoreLooks() {
  openTemplatesDialog("additional")
}

async function onDialogConfirm() {
  if (!uploadedIds.value.length) {
    quasar.notify({ color: "warning", message: "Please upload photos first" })
    return
  }
  if (dialogMode.value === "initial") {
    if (dialogSelection.value.length !== 3) return
    selectedTemplates.value = dialogSelection.value.slice()
    initialLoadingTemplates.value = dialogSelection.value.slice()
    templatesConfirmed.value = true
    saveSession()
    quasar.notify({ message: "Templates saved", color: "primary" })
    dialogOpen.value = false
    void nextTick(() => scrollToTopSmooth())
    // Capture current banana images as baseline for session-only results
    try {
      imageCreations.filter.model = "nano-banana" as any
      await imageCreations.loadCreations(userAuth.userId || undefined)
      const snap = imageCreations.allCreations.map((x) => x.id)
      sessionBaselineIds.value = snap.slice()
      sessionCreatedIds.value = []
      sessionExpectedTotal.value = dialogSelection.value.length
      pendingBaselineIds.value = snap.slice()
      lastKnownIds.value = snap.slice()
      saveSession()
    } catch {}
    await scheduleBananaRenders(selectedTemplateObjs.value)
    return
  }

  const ids = dialogSelection.value.slice()
  if (!ids.length) return
  try {
    generatingMore.value = true
    dialogOpen.value = false
    additionalLoadingTemplates.value = ids.slice()
    const templates = ids.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
    if (!templates.length) {
      generatingMore.value = false
      additionalLoadingTemplates.value = []
      return
    }
    // Extend expected total for this session; keep original baseline
    sessionExpectedTotal.value += ids.length
    saveSession()
    pendingNewCount.value += templates.length
    await scheduleBananaRenders(templates)
    quasar.notify({ color: "primary", message: `Rendering ${templates.length} new looks…` })
    if (!creationsPollTimer) startCreationsPoll()
    void userAuth.loadUserData()
  } catch (e: any) {
    catchErr(e)
    generatingMore.value = false
    additionalLoadingTemplates.value = []
  }
}

// Build and queue banana image requests
async function scheduleBananaRenders(templates: PromptTemplate[]) {
  if (!templates.length || !uploadedIds.value.length) return
  try {
    isWaitingForImages.value = true
    pendingBaselineIds.value = generatedImageIds.value.slice()
    pendingNewCount.value = templates.length
    const requests = templates.map((tpl) => {
      const resolved = promptFromTemplates([tpl])
      return {
        prompt: subjectDescription ? `${resolved.prompt} Subject Base Details: ${subjectDescription}` : resolved.prompt,
        negativePrompt: resolved.negativePrompt,
        quantity: 1,
        model: "nano-banana" as const,
        public: false,
        uploadedStartImageIds: uploadedIds.value.slice(),
      }
    })
    const res = await createQueueAsyncBatch({ requests, emailNotify: false })
    const batchId = res.data?.batchId
    if (!creationsPollTimer) startCreationsPoll()
    if (batchId) startBatchStatusWatch(batchId)
    void userAuth.loadUserData()
  } catch (e: any) {
    catchErr(e)
  }
}

// Poll for new creations, collecting ids belonging to this user session
function startCreationsPoll() {
  stopCreationsPoll()
  const poll = async () => {
    try {
      imageCreations.filter.model = "nano-banana" as any
      // Force a fresh fetch of the latest page each tick (not pagination)
      imageCreations.creations = []
      ;(imageCreations as any).lastQueryKey = null
      await imageCreations.loadCreations(userAuth.userId || undefined)
    } catch (e) {
      console.warn("failed to load creations", e)
    }
    const allIds = imageCreations.allCreations.map((x) => x.id)
    const baseline = sessionBaselineIds.value.length ? sessionBaselineIds.value : lastKnownIds.value
    // Session-new images = everything after the stored baseline minus ones we've already recorded
    const sessionNew = allIds.filter((id) => !baseline.includes(id))
    const newlyAdded = sessionNew.filter((id) => !sessionCreatedIds.value.includes(id))

    if (newlyAdded.length > 0) {
      sessionCreatedIds.value.push(...newlyAdded)
      generatedImageIds.value = sessionCreatedIds.value.slice()
      lastKnownIds.value = allIds.slice()
      pendingNewCount.value = Math.max(0, pendingNewCount.value - newlyAdded.length)
      saveSession()
    }
    // Always refresh waiting flag in case no new items were detected this tick
    isWaitingForImages.value = sessionCreatedIds.value.length < sessionExpectedTotal.value

    // If we've met the expected total for the session, clear any preview loaders
    if (!isWaitingForImages.value) {
      generatingMore.value = false
      additionalLoadingTemplates.value = []
      initialLoadingTemplates.value = []
      pendingNewCount.value = 0
      saveSession()
    }

    const expecting = sessionCreatedIds.value.length < sessionExpectedTotal.value
    if (sessionCreatedIds.value.length >= 3 && step.value !== "results") {
      step.value = "results"
      saveSession()
      maybeStartSignupNudge()
    }
    if (!expecting) {
      stopCreationsPoll()
      return
    }
    creationsPollTimer = window.setTimeout(poll, 8000)
  }
  void poll()
}
function stopCreationsPoll() {
  if (creationsPollTimer) window.clearTimeout(creationsPollTimer)
  creationsPollTimer = null
}

function startBatchStatusWatch(batchId: string) {
  stopBatchStatusWatch()
  const check = async () => {
    try {
      const { data: batch } = await createBatchStatus({ batchId })
      if (!batch) {
        stopBatchStatusWatch()
        return
      }
      const allDone = batch.counts.finished + batch.counts.failed >= batch.counts.total
      if (allDone || batch.status === "completed" || batch.status === "error") {
        // Trigger an immediate creations refresh so images display without waiting for the next poll tick
        startCreationsPoll()
        stopBatchStatusWatch()
        return
      }
    } catch (e) {
      // ignore transient errors
    }
    batchStatusTimer = window.setTimeout(check, 2000)
  }
  void check()
}
function stopBatchStatusWatch() {
  if (batchStatusTimer) window.clearTimeout(batchStatusTimer)
  batchStatusTimer = null
}

function startAgain() {
  stopCreationsPoll()
  selectedTemplates.value = []
  generatedImageIds.value = []
  uploadedIds.value = []
  templatesConfirmed.value = false
  initialLoadingTemplates.value = []
  additionalLoadingTemplates.value = []
  clearSession()
  step.value = "capture"
  window.location.reload()
}

function goToCreatePage() {
  void toCreatePage({ model: "nano-banana", type: "image" }, router, { noCreateModal: true })
}

// share/download/animate: provided by useMagicMirrorResults

function scrollToTopSmooth() {
  try {
    const el: any = document.scrollingElement || document.documentElement || document.body
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: 0, behavior: "smooth" })
    else window.scrollTo({ top: 0, behavior: "smooth" })
    const page = document.querySelector(".q-page") as HTMLElement | null
    if (page) page.scrollIntoView({ behavior: "smooth", block: "start" })
  } catch {}
}

watch(step, () => {
  void userAuth.loadUserData()
})

// Close login dialog when user logs in
watch(
  () => userAuth.loggedIn,
  (val) => {
    if (val) loginDialogOpen.value = false
  },
)

onMounted(() => {
  void loadSession()
  void promptTplStore.loadSubjectFaceTemplates()
})
onBeforeUnmount(() => {
  stopCreationsPoll()
  stopAnimPromptCountdown()
  stopBatchStatusWatch()
  if (signupTimer) window.clearTimeout(signupTimer)
})

// Delayed signup nudge after first results
const signupNudgeOpen = ref(false)
let signupTimer: number | null = null
function maybeStartSignupNudge() {
  if (signupTimer || userAuth.userProfile?.email) return
  signupTimer = window.setTimeout(() => {
    if (!userAuth.userProfile?.email) signupNudgeOpen.value = true
  }, 20000)
}
</script>

<style scoped>
/* Responsive grid for template preview */
.template-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  justify-items: center;
  justify-content: center;
  align-content: center;
  width: 100%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}
/* Cards fill their grid column, but don't explode on desktop */
.template-card-box {
  aspect-ratio: 3/5;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  display: block;
  max-width: 240px;
  margin: 0 auto;
}
@media (min-width: 1024px) {
  .template-card-box {
    max-width: 260px;
  }
}
.template-item {
  width: 100%;
  min-width: 0;
}
@media (max-width: 599px) {
  .template-preview-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  /* Make preview cards shorter on mobile to avoid scrolling */
  .template-card-box :deep(.template-item) {
    min-height: 120px;
  }
}
.template-item :deep(.q-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-self: center;
}
.template-item :deep(h6),
.template-item :deep(.title),
.template-item :deep(.q-card__section) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* No overlay padding needed; actions render below media via MediaGallery */
.template-grid > .template-item {
  display: flex;
  flex-direction: column;
}
.template-grid > .template-item .template-card-box {
  flex: 1 1 auto;
  display: block;
}
.template-grid > .template-item .template-card-box :deep(.template-item) {
  height: 100%;
}
.template-grid > .template-item .template-card-box :deep(.q-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.template-grid > .template-item > .q-mt-xs {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.grid-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: #000;
  border-radius: 8px;
}
.preview-flex-center {
  display: flex;
  justify-content: center;
  width: 100%;
}

/* Invisible ghost span to preserve reactivity without showing a letter */
.reactive-ghost {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* Wider template picker on desktop: target 3–6 columns with 180px min tiles */
@media (min-width: 600px) {
  .tpl-dialog-body {
    width: 90vw;
    max-width: 1200px;
    padding: 12px;
    box-sizing: border-box;
    margin: 0 auto;
  }
}

/* Full-width picker container on mobile */
@media (max-width: 599px) {
  .tpl-dialog-body {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    padding: 12px;
    box-sizing: border-box;
  }
}
</style>
