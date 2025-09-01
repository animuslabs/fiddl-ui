<template lang="pug">
q-page.full-width
  .centered.q-mt-md
    h1.lobster-font Magic Mirror
  .centered.q-ma-md
    p.text-primary Transform your selfie into different characters in minutes
  div(v-if="sessionLoaded && step === 'capture'")
    .centered
      MagicMirrorCamera(
        @captured="onCaptured"
        @error="onCaptureError"
        @auth-required="onAuthRequired"
        @insufficient-points="onInsufficientPoints"
      )

  div(v-else-if="step === 'training'")

  div(v-else-if="step === 'selectTemplates'")
    .centered(v-if="!templatesConfirmed")
      h4 Choose 3 looks
    .centered.q-mt-sm(v-if="trainingStatus !== 'succeeded'")
      .centered.q-mb-xs
        p.text-white.text-capitalize Training {{ trainingStatus }} {{ trainingProgress == 0?'': trainingProgress+`%`}}
      .centered.full-width
        q-linear-progress(:value="trainingProgress/100" stripe size="10px" color="primary" class="q-mt-xs" style="max-width:600px;")
    // Show an indeterminate progress bar while first images are being generated
    .centered.q-mt-sm(v-if="trainingStatus === 'succeeded' && isWaitingForImages")
      .centered.q-mb-xs
        p.text-white Generating your images...
      .centered.full-width
        q-linear-progress(indeterminate size="10px" color="primary" class="q-mt-xs" style="max-width:600px;")
    .centered.q-mt-sm(v-if="!templatesConfirmed")
      q-btn.q-mt-md(color="primary" label="Pick Looks" no-caps @click="openTemplatesDialog('initial')")

    //- Show preview of selected templates during training
    .centered.q-mt-sm.q-ma-md.q-pa-md(v-if="showInitialPreview || additionalLoadingTemplates.length > 0")
      .full-width.bg-blur.q-pa-lg(style="max-width:720px;")
        .template-preview-grid(:style="templatesPreviewGridStyle")
          .template-item(v-for="t in selectedTemplateObjs" :key="`${t.id}-${t.name}`")
            .template-card-box
              //- Hidden element to trigger Vue reactivity
              PromptTemplateCard.full-width(:template="t" :gender="genderForTemplates || 'female'" :selectable="false" no-title :ratio="isDesktop ? 3/5 : 1")
              span {{ t.name[0] }}
        .row.items-center.justify-center.q-mt-md(v-if="trainingStatus !== 'succeeded'")
          q-spinner-dots(color="primary" size="24px")
          span.text-primary.q-ml-sm Training your model...
        .row.items-center.justify-center.q-mt-md(v-else)
          q-spinner-dots(color="primary" size="24px")
          span.text-primary.q-ml-sm Generating your images...

  div(v-else-if="step === 'results'").relative-position.full-width
    .row.items-center.z-top.bg-blur.full-width(style="position:sticky; top:50px;")
      .centered.col-12.full-width
        q-btn(flat icon="refresh" label="Start again" :size="isDesktop? 'lg':'md'" no-caps @click="startAgain")
        q-btn(color="primary" square icon="group" label="More Looks" :size="isDesktop? 'lg':'md'" no-caps @click="openMoreLooks")
        q-btn(flat icon="home_repair_service" label="Advanced" :size="isDesktop? 'lg':'md'" no-caps @click="goToCreatePage")

    .centered.q-mt-sm.q-ma-md.q-pa-md(v-if="showTemplatePreview")
      .full-width.bg-blur.q-pa-lg(style="max-width:720px;")
        .template-preview-grid(v-if="currentPreviewTemplates.length > 0 || additionalLoadingTemplates.length > 0" :style="previewGridStyle")
          .template-item(v-for="t in currentPreviewTemplates" :key="`${t.id}-${t.name}`")
            .template-card-box
              //- Hidden element to trigger Vue reactivity
              PromptTemplateCard(:template="t" :gender="genderForTemplates || 'female'" :selectable="false" :ratio="isDesktop ? 3/5 : 1")
              span {{ t.name[0] }}
        .template-preview-grid(v-else :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }")
          .template-item(v-for="i in previewSkeletonCount" :key="i")
            q-skeleton(type="rect" style="width:100%; aspect-ratio:3/4; border-radius:8px;")
        .row.items-center.justify-center.q-mt-md
          q-spinner-dots(color="primary" size="24px")
          span.text-primary.q-ml-sm {{ previewLoadingMessage }}

    div(v-if="generatedImageIds.length > 0" style="width:100%;")
      .centered.full-width.q-mt-lg
        MediaGallery.q-pl-md.q-pr-md(
          :mediaObjects="mediaObjects"
          layout="mosaic"
          :rowHeightRatio="1"
          :colsDesktop="3"
          :colsMobile="1"
          :thumbSizeDesktop="350"
          :thumbSizeMobile="400"
          :gap="8"
          :centerAlign="true"
        )
          template(#actions="{ media }")
            .row.items-center.justify-center.q-gutter-sm.q-pt-sm.bg-grey-10.q-pa-md
              q-btn(flat size="sm" icon="share" label="Share" no-caps @click="shareImage(media.id)")
              q-btn(flat size="sm" icon="download" label="Download" no-caps @click="downloadImage(media.id)")
              q-btn(color="primary"  flat square size="sm" icon="movie" label="Animate" no-caps @click="animateImage(media.id)")
                q-tooltip(v-if="triggeredVideoIds.includes(media.id)") Animation already triggered

  q-dialog(v-model="loginDialogOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Login or Register
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mt-sm
          p.text-primary Please login or register to use Magic Mirror.
        PrivyLogin
  q-dialog(v-model="insufficientDialogOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Not enough points
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        p.text-primary You need {{ mmRequiredPoints }} Fiddl Points to use Magic Mirror (training set + model + 3 images).
        p.text-secondary You have {{ availablePoints }} points. Missing {{ missingPoints }} points.
      q-card-actions(align="right")
        q-btn(flat label="Cancel" v-close-popup)
        q-btn(color="primary" label="Add Points" no-caps @click="goToAddPoints")
  q-dialog(v-model="dialogOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Pick looks
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        PromptTemplatesPicker(
          :gender="genderForTemplates || 'female'"
          :selected="dialogSelection"
          :maxSelected="3"
          :selectionMode="'multi'"
          :selectable="true"
          :showConfirm="true"
          :confirmLabel="dialogMode === 'initial' ? 'Confirm Choices' : 'Generate'"
          @update:selected="dialogSelection = $event"
          @confirm="onDialogConfirm"
        )

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
  div(v-if="!userAuth.userProfile?.email && step != 'capture'").q-mb-lg
    .centered.q-mt-sm
      q-card(style="width:520px; max-width:100vw;")
        q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
          .centered
            h6.q-mt-none.q-mb-none Login to save your creations and receive 100 Fiddl Points
        q-separator
        q-card-section
          PrivyLogin
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from "vue"
import { useQuasar, Loading } from "quasar"
import { useUserAuth } from "src/stores/userAuth"
import MagicMirrorCamera from "src/components/magic/MagicMirrorCamera.vue"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import PromptTemplatesPicker from "src/components/magic/PromptTemplatesPicker.vue"
import PrivyLogin from "src/components/dialogs/PrivyLogin.vue"
import MediaGallery, { type MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { img } from "lib/netlifyImg"
import { createMagicTrainingSet } from "src/lib/magic/magicTrainingSet"
import { scheduleMagicRenders } from "src/lib/magic/magicApi"
import { modelsCreateModel, modelsGetCustomModel, modelsGetTrainingStatus, trainingSetsDescribeSet, trainingSetsGetSet } from "lib/orval"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useRouter } from "vue-router"
import { type Gender, type PromptTemplate, type GenderedPromptTemplate, resolveGenderedTemplates } from "src/lib/promptTemplates"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"
import { catchErr } from "lib/util"
import { toCreatePage } from "lib/routeHelpers"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { prices } from "src/stores/pricesStore"

type Step = "init" | "capture" | "training" | "selectTemplates" | "results"

const quasar = useQuasar()
const userAuth = useUserAuth()
const imageCreations = useImageCreations()
const router = useRouter()

let subjectDescription: string | undefined
const step = ref<Step>("init")
const sessionLoaded = ref(false)
const loginDialogOpen = ref(false)
const insufficientDialogOpen = ref(false)
const mmRequiredPoints = computed(() => prices.forge.createTrainingSet + prices.forge.trainBaseModel.fluxDev + 3 * prices.image.model.custom)
const availablePoints = computed(() => userAuth.userData?.availablePoints || 0)
const missingPoints = computed(() => Math.max(0, mmRequiredPoints.value - availablePoints.value))

const dialogOpen = ref(false)
const dialogSelection = ref<string[]>([])
const dialogMode = ref<"initial" | "additional">("initial")

const generatingMore = ref(false)
const selectedTemplates = ref<string[]>([])
const generatedImageIds = ref<string[]>([])

const trainingSetId = ref<string | null>(null)
const customModelId = ref<string | null>(null)
const trainingStatus = ref<string>("processing")
const trainingProgress = ref<number>(0)
const trainingGender = ref<string | null>(null)
const elapsedTime = ref<string>("0:00")
const remainingTime = ref<string>("0:00")
let pollTimer: number | null = null
let creationsPollTimer: number | null = null
const templatesConfirmed = ref(false)
const scheduled = ref(false)
const scheduledAt = ref<number | null>(null)
const pendingBaselineIds = ref<string[]>([])

watch(step, () => {
  void userAuth.loadUserData()
})

const additionalLoadingTemplates = ref<string[]>([])
const initialLoadingTemplates = ref<string[]>([])
const pendingNewCount = ref<number>(0)
const lastKnownIds = ref<string[]>([])
const isWaitingForImages = ref(false)

const SESSION_KEY = "mmState"
const promptTplStore = usePromptTemplatesStore()

const vidStore = useCreateVideoStore()
const animateDialogOpen = ref(false)
const animateDialogImageId = ref<string | null>(null)
const animating = ref(false)

const animPromptVisible = ref(false)
const animPromptSecondsLeft = ref(60)
let animPromptTimer: number | null = null
const animPromptReady = computed(() => animPromptSecondsLeft.value <= 0)
const animPromptLabel = computed(() => (animPromptReady.value ? "Go to Video" : `Video available in ${formatMMSS(animPromptSecondsLeft.value)}`))
function formatMMSS(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
function startAnimPromptCountdown() {
  stopAnimPromptCountdown()
  animPromptSecondsLeft.value = 180
  animPromptVisible.value = true
  const tick = () => {
    if (animPromptSecondsLeft.value <= 0) {
      stopAnimPromptCountdown()
      return
    }
    animPromptSecondsLeft.value -= 1
    animPromptTimer = window.setTimeout(tick, 1000)
  }
  animPromptTimer = window.setTimeout(tick, 1000)
}
function stopAnimPromptCountdown() {
  if (animPromptTimer) window.clearTimeout(animPromptTimer)
  animPromptTimer = null
}

const ANIMATED_KEY = "mmAnimatedVideoIds"
const triggeredVideoIds = ref<string[]>([])
function loadAnimatedIds() {
  try {
    triggeredVideoIds.value = JSON.parse(sessionStorage.getItem(ANIMATED_KEY) || "[]")
  } catch {}
}
function saveAnimatedIds() {
  try {
    sessionStorage.setItem(ANIMATED_KEY, JSON.stringify(triggeredVideoIds.value))
  } catch {}
}

const defaultVideoDuration = 5
const klingCostPerSecond = computed(() => prices.video.model.kling)
const estimatedVideoCost = computed(() => klingCostPerSecond.value * defaultVideoDuration)
const hasAnimatedSelected = computed(() => (animateDialogImageId.value ? triggeredVideoIds.value.includes(animateDialogImageId.value) : false))

const genderForTemplates = computed<Gender | null>(() => {
  const g = (trainingGender.value || "").toLowerCase()
  if (g === "male" || g === "female") return g as Gender
  if (g === "unknown") return "female"
  return null
})

const rawTemplates = computed<GenderedPromptTemplate[]>(() => promptTplStore.templates as unknown as GenderedPromptTemplate[])
const displayTemplates = computed<PromptTemplate[]>(() => {
  const g = genderForTemplates.value
  return g ? resolveGenderedTemplates(rawTemplates.value, g) : []
})

const templatesById = computed(() => new Map(displayTemplates.value.map((t) => [t.id, t] as [string, PromptTemplate])))

// Resolve a template by either its stored id (gender-suffixed) or a base id
function getTemplateByAnyId(id: string): PromptTemplate | undefined {
  const direct = templatesById.value.get(id)
  if (direct) return direct
  const g = genderForTemplates.value
  if (g && !id.endsWith(`-${g}`)) {
    const suffixed = `${id}-${g}`
    return templatesById.value.get(suffixed)
  }
  return undefined
}

const selectedTemplateObjs = computed<PromptTemplate[]>(() => {
  return selectedTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
})

const templatesPreviewGridStyle = computed(() => {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    justifyItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
    width: "100%",
    maxWidth: "100%",
  }
})

// Unified preview templates logic
const currentPreviewTemplates = computed<PromptTemplate[]>(() => {
  if (initialLoadingTemplates.value.length > 0) {
    return initialLoadingTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
  }
  if (additionalLoadingTemplates.value.length > 0) {
    return additionalLoadingTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
  }
  return []
})

const previewGridStyle = computed(() => {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    justifyItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
    width: "100%",
    maxWidth: "100%",
  }
})

const previewSkeletonCount = computed(() => {
  const count = initialLoadingTemplates.value.length || additionalLoadingTemplates.value.length || 3
  return Math.max(1, Math.min(3, count))
})

const previewLoadingMessage = computed(() => {
  if (initialLoadingTemplates.value.length > 0) return "Generating your looks..."
  if (additionalLoadingTemplates.value.length > 0) return "Rendering more looks..."
  return "Processing..."
})

const showInitialPreview = computed(() => templatesConfirmed.value && (trainingStatus.value !== "succeeded" || (scheduled.value && generatedImageIds.value.length === 0)))
const showTemplatePreview = computed(() => initialLoadingTemplates.value.length > 0 || additionalLoadingTemplates.value.length > 0 || pendingNewCount.value > 0 || generatingMore.value || isWaitingForImages.value)

const isDesktop = computed(() => quasar.screen.gt.sm)
const mediaObjects = computed<MediaGalleryMeta[]>(() => generatedImageIds.value.map((id) => ({ id, url: img(id, "lg"), type: "image" })))

function saveSession() {
  const data = {
    trainingSetId: trainingSetId.value,
    customModelId: customModelId.value,
    selectedTemplates: selectedTemplates.value,
    templatesConfirmed: templatesConfirmed.value,
    scheduled: scheduled.value,
    scheduledAt: scheduledAt.value,
    trainingGender: trainingGender.value,
    subjectDescription,
    step: step.value,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

async function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) {
      sessionLoaded.value = true
      step.value = "capture"
      return
    }
    const data = JSON.parse(raw)
    trainingSetId.value = data.trainingSetId || null
    customModelId.value = data.customModelId || null
    if (Array.isArray(data.selectedTemplates)) {
      selectedTemplates.value = data.selectedTemplates
      // Set initialLoadingTemplates if we haven't generated images yet
      if (data.templatesConfirmed && !data.scheduled) {
        initialLoadingTemplates.value = data.selectedTemplates.slice()
      } else if (data.scheduled && data.step === "selectTemplates") {
        // If scheduled but still in selectTemplates step, show loading templates
        initialLoadingTemplates.value = data.selectedTemplates.slice()
      }
    }
    templatesConfirmed.value = !!data.templatesConfirmed
    scheduled.value = !!data.scheduled
    scheduledAt.value = typeof data.scheduledAt === "number" ? data.scheduledAt : null
    trainingGender.value = data.trainingGender || null
    subjectDescription = data.subjectDescription || undefined
    const sessStep = data.step as Step | undefined
    if (sessStep) step.value = sessStep
    if ((trainingSetId.value || customModelId.value) && (!trainingGender.value || trainingGender.value === "unknown" || !subjectDescription)) {
      await ensureTrainingSetGenderLoaded()
    }
    if (customModelId.value) {
      startTrainingPoll()
      if (scheduled.value && templatesConfirmed.value) startCreationsPoll()
    }
    sessionLoaded.value = true
  } catch (e) {
    console.warn("failed to load session", e)
    step.value = "capture"
  }
}

async function ensureTrainingSetGenderLoaded() {
  try {
    const needGender = !trainingGender.value || trainingGender.value === "unknown"
    const needSubject = !subjectDescription
    if (!needGender && !needSubject) return

    if (!trainingSetId.value && customModelId.value) {
      const resp = await modelsGetCustomModel({ id: customModelId.value })
      const tsid = resp.data?.trainingSetId || null
      if (tsid) {
        trainingSetId.value = tsid
        saveSession()
      }
    }
    if (!trainingSetId.value) return
    let data: any | null = null
    const resp = await trainingSetsDescribeSet({ trainingSetId: trainingSetId.value })
    data = resp.data || null
    if (data) {
      if (needGender && typeof data.subjectGender === "string") trainingGender.value = data.subjectGender || null
      if (needSubject && typeof data.subjectDescription === "string") subjectDescription = data.subjectDescription || undefined
      saveSession()
    }
  } catch (e) {
    console.warn("failed to resolve training set meta", e)
  }
}

async function onCaptured(blobs: Blob[]) {
  try {
    step.value = "training"
    Loading.show({ message: "Creating training set..." })
    const { trainingSetId: tsid } = await createMagicTrainingSet(blobs, {
      onStage: (stage) => {
        const msg = stage === "zip" ? "Preparing photos..." : stage === "create" ? "Creating training set..." : stage === "uploadZip" ? "Uploading photos..." : stage === "thumbnails" ? "Uploading thumbnails..." : stage === "finalize" ? "Finalizing training set..." : "Working..."
        Loading.show({ message: msg })
      },
      onProgress: (pct) => Loading.show({ message: `Uploading... ${pct}%` }),
    })
    trainingSetId.value = tsid
    saveSession()
    await startTraining()
  } catch (e: any) {
    catchErr(e)
    step.value = "capture"
  } finally {
    Loading.hide()
  }
}
function onCaptureError(reason: string) {
  catchErr(new Error("Capture error: " + reason))
}

function onAuthRequired() {
  quasar.notify({ color: "primary", message: "Please login or register to start capturing" })
  loginDialogOpen.value = true
}

function onInsufficientPoints() {
  quasar.notify({ color: "negative", message: "Not enough Fiddl Points to start Magic Mirror" })
  insufficientDialogOpen.value = true
}

function goToAddPoints() {
  insufficientDialogOpen.value = false
  void router.push({ name: "addPoints" })
}

function generateModelName() {
  const base = "MagicMirror-" + Date.now().toString(36).slice(-5)
  return base.slice(0, 28)
}

async function startTraining() {
  if (!trainingSetId.value) return
  try {
    Loading.show({ message: "Starting training..." })
    await ensureTrainingSetGenderLoaded()
    const { data: modelId } = await modelsCreateModel({
      baseModel: "fluxDev",
      description: "",
      fineTuneType: "lora",
      modelMode: "subject",
      name: generateModelName(),
      trainingSetId: trainingSetId.value,
    })
    customModelId.value = modelId
    trainingStatus.value = "processing"
    trainingProgress.value = 0
    Loading.hide()
    step.value = "selectTemplates"
    saveSession()
    void userAuth.loadUserData()
    void nextTick(() => openTemplatesDialog("initial"))
    startTrainingPoll()
  } catch (e: any) {
    Loading.hide()
    catchErr(e)
    step.value = "capture"
  }
}

function startTrainingPoll() {
  stopTrainingPoll()
  const poll = async () => {
    if (!customModelId.value) return
    try {
      const { data } = await modelsGetTrainingStatus({ id: customModelId.value })
      trainingStatus.value = data.status
      trainingProgress.value = data.progress || 0
      elapsedTime.value = data.elapsedTime
      remainingTime.value = data.remainingTime
      if (data.status === "succeeded") {
        stopTrainingPoll()
        maybeGenerateIfReady()
      } else if (data.status === "failed") {
        clearSession()
        step.value = "capture"
        quasar.notify({ color: "negative", message: "Training failed, please try again" })
        stopTrainingPoll()
      }
    } catch (e) {
      console.warn("poll error", e)
    } finally {
      if (trainingStatus.value !== "succeeded" && trainingStatus.value !== "failed") {
        pollTimer = window.setTimeout(poll, 8000)
      }
    }
  }
  pollTimer = window.setTimeout(poll, 2000)
}
function stopTrainingPoll() {
  if (pollTimer) window.clearTimeout(pollTimer)
  pollTimer = null
}

function maybeGenerateIfReady() {
  if (templatesConfirmed.value && trainingStatus.value === "succeeded" && customModelId.value) void scheduleAndPollIfReady()
}

async function scheduleAndPollIfReady() {
  if (!customModelId.value) return
  if (scheduled.value) {
    startCreationsPoll()
    return
  }
  try {
    Loading.show({ message: "Scheduling your images..." })
    await ensureTrainingSetGenderLoaded()
    const templates = selectedTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
    await scheduleMagicRenders({
      customModelId: customModelId.value,
      templates,
      subjectDescription: subjectDescription ?? "",
    })
    scheduled.value = true
    scheduledAt.value = Date.now()
    saveSession()
    void userAuth.loadUserData()
    startCreationsPoll()
  } catch (e: any) {
    catchErr(e)
  } finally {
    Loading.hide()
  }
}

function startCreationsPoll() {
  stopCreationsPoll()
  const poll = async () => {
    if (!customModelId.value) return
    const prevWaiting = isWaitingForImages.value

    imageCreations.filter.model = "custom"
    imageCreations.filter.customModelId = customModelId.value
    try {
      if (imageCreations.customModelId !== customModelId.value) {
        await imageCreations.setCustomModelId(customModelId.value, userAuth.userId || undefined)
      } else {
        imageCreations.creations = []
        await imageCreations.loadCreations(userAuth.userId || undefined)
      }
    } catch (e) {
      console.warn("loadCreations failed", e)
    }

    const ids: string[] = []
    for (const req of imageCreations.creations) for (const id of req.mediaIds) if (!ids.includes(id)) ids.push(id)

    const oldSet = new Set(lastKnownIds.value)
    const deltaNew = ids.filter((id) => !oldSet.has(id))

    const prevCount = generatedImageIds.value.length
    generatedImageIds.value = ids.slice(0, 16)
    lastKnownIds.value = generatedImageIds.value.slice()

    // Check if initial templates are done
    if (initialLoadingTemplates.value.length > 0 && generatedImageIds.value.length >= initialLoadingTemplates.value.length) {
      initialLoadingTemplates.value = []
    }

    // Check if additional templates are done
    if (pendingNewCount.value > 0) {
      const baselineSet = new Set(pendingBaselineIds.value)
      const newSinceBaseline = ids.filter((id) => !baselineSet.has(id))
      if (newSinceBaseline.length >= pendingNewCount.value) {
        additionalLoadingTemplates.value = []
        pendingNewCount.value = 0
        generatingMore.value = false
        pendingBaselineIds.value = []
      }
    }

    const expectingInitial = scheduled.value && generatedImageIds.value.length < 3
    const expectingAdditional = pendingNewCount.value > 0
    const expecting = expectingInitial || expectingAdditional

    if (prevWaiting && !expecting && (deltaNew.length > 0 || prevCount === 0) && generatedImageIds.value.length > 0) {
      void nextTick(() => {
        try {
          scrollToTopSmooth()
        } catch {}
      })
    }
    isWaitingForImages.value = expecting

    if (generatedImageIds.value.length >= 3 && step.value !== "results") {
      step.value = "results"
      Loading.show({ message: "Images Loading" })
      setTimeout(() => Loading.hide(), 4000)
      saveSession()
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

function startAgain() {
  stopTrainingPoll()
  stopCreationsPoll()
  selectedTemplates.value = []
  generatedImageIds.value = []
  trainingSetId.value = null
  customModelId.value = null
  trainingStatus.value = "processing"
  trainingProgress.value = 0
  trainingGender.value = null
  templatesConfirmed.value = false
  scheduled.value = false
  scheduledAt.value = null
  clearSession()
  step.value = "capture"
  window.location.reload()
}

function goToCreatePage() {
  void toCreatePage({ model: "custom", type: "image", customModelId: customModelId.value!, customModelName: undefined }, router, { noCreateModal: true })
}

async function shareImage(id: string) {
  try {
    const url = img(id, "lg")
    const nav: any = navigator as any
    if (nav && typeof nav.share === "function") {
      await nav.share({ title: "My Magic Mirror image", text: "Check out my Magic Mirror result", url })
    } else {
      await navigator.clipboard.writeText(url)
      quasar.notify({ message: "Link copied to clipboard", color: "primary" })
    }
  } catch (e: any) {
    catchErr(e)
  }
}

async function downloadImage(id: string) {
  try {
    const url = img(id, "lg")
    const resp = await fetch(url, { mode: "cors" })
    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = id + ".webp"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  } catch (e: any) {
    catchErr(e)
  }
}

function animateImage(id: string) {
  animateDialogImageId.value = id
  animateDialogOpen.value = true
}

async function triggerAnimation() {
  if (!animateDialogImageId.value) return
  try {
    animating.value = true
    vidStore.setReq({ prompt: "Animate this image", model: "kling", aspectRatio: "9:16", public: false, quantity: 1, duration: defaultVideoDuration, startImageId: animateDialogImageId.value })
    await vidStore.createVideoRequest()
    void userAuth.loadUserData()
    if (!triggeredVideoIds.value.includes(animateDialogImageId.value)) {
      triggeredVideoIds.value.push(animateDialogImageId.value)
      saveAnimatedIds()
    }
    animateDialogOpen.value = false
    startAnimPromptCountdown()
    quasar.notify({ message: "Video animation started. It may take a few minutes to complete.", color: "primary" })
  } catch (e: any) {
    catchErr(e)
  } finally {
    animating.value = false
  }
}

function goToCreateVideo() {
  animateDialogOpen.value = false
  animPromptVisible.value = false
  stopAnimPromptCountdown()
  void toCreatePage({ model: "kling", type: "video" }, router, { noCreateModal: true })
}

function scrollToTopSmooth() {
  try {
    const el: any = document.scrollingElement || document.documentElement || document.body
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: 0, behavior: "smooth" })
    else window.scrollTo({ top: 0, behavior: "smooth" })
    const page = document.querySelector(".q-page") as HTMLElement | null
    if (page) page.scrollIntoView({ behavior: "smooth", block: "start" })
  } catch {}
}

function openTemplatesDialog(mode: "initial" | "additional") {
  dialogMode.value = mode
  dialogSelection.value = mode === "initial" ? selectedTemplates.value.slice() : []
  dialogOpen.value = true
}
function openMoreLooks() {
  openTemplatesDialog("additional")
}

async function onDialogConfirm() {
  if (dialogMode.value === "initial") {
    if (dialogSelection.value.length !== 3) return
    selectedTemplates.value = dialogSelection.value.slice()
    initialLoadingTemplates.value = dialogSelection.value.slice()
    templatesConfirmed.value = true
    saveSession()
    quasar.notify({ message: "Templates saved", color: "primary" })
    dialogOpen.value = false
    void nextTick(() => scrollToTopSmooth())
    maybeGenerateIfReady()
    return
  }

  if (!customModelId.value) return
  const ids = dialogSelection.value.slice()
  if (!ids.length) return
  try {
    generatingMore.value = true
    dialogOpen.value = false
    // Set the templates we're generating
    additionalLoadingTemplates.value = ids.slice()
    const templates = ids.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[]
    if (!templates.length) {
      generatingMore.value = false
      additionalLoadingTemplates.value = []
      return
    }
    pendingBaselineIds.value = generatedImageIds.value.slice()

    pendingNewCount.value += templates.length
    await ensureTrainingSetGenderLoaded()
    await scheduleMagicRenders({ customModelId: customModelId.value, templates, subjectDescription: subjectDescription ?? "" })
    quasar.notify({ color: "primary", message: `Rendering ${templates.length} new looks…` })
    if (!creationsPollTimer) startCreationsPoll()
    void userAuth.loadUserData()
  } catch (e: any) {
    catchErr(e)
    generatingMore.value = false
    additionalLoadingTemplates.value = []
  }
}

onMounted(() => {
  void loadSession()
  loadAnimatedIds()
  void promptTplStore.loadSubjectFaceTemplates()
})
onBeforeUnmount(() => {
  stopTrainingPoll()
  stopCreationsPoll()
  stopAnimPromptCountdown()
})
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
.slot-actions {
  position: absolute !important;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 6px 4px !important;
  background: transparent !important;
  pointer-events: auto;
}
:deep(.media-wrapper) {
  padding-bottom: 48px;
}
:deep(.media-wrapper) > .q-img,
:deep(.media-wrapper) > div > video {
  height: calc(100% - 48px) !important;
}
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
</style>
