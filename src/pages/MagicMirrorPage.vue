<template lang="pug">
q-page.full-width
  .centered.q-mt-md
    h2.lobster-font Magic Mirror Pro
  .centered.q-ma-md
    p.text-primary Transform your selfie into different characters in minutes
  div(v-if="sessionLoaded && step === 'capture'")
    .centered
      MagicMirrorCamera(
        :requiredPoints="mmRequiredPoints"
        @captured="onCaptured"
        @error="onCaptureError"
        @auth-required="onAuthRequired"
        @insufficient-points="onInsufficientPoints"
      )

  div(v-else-if="step === 'training'")
    .centered.q-mt-sm
      .centered.q-mb-xs
        p.text-white {{ trainingPhaseMessage }}
      .centered.full-width
        q-linear-progress(
          v-if="trainingPhasePct !== null"
          :value="trainingPhasePct/100"
          stripe
          size="10px"
          color="primary"
          class="q-mt-xs"
          style="max-width:600px;"
        )
        q-linear-progress(
          v-else
          indeterminate
          size="10px"
          color="primary"
          class="q-mt-xs"
          style="max-width:600px;"
        )

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
      MagicPreviewGrid(
        :templates="selectedTemplateObjs"
        :isDesktop="isDesktop"
        :gender="genderForTemplates || 'female'"
        :skeletonCount="0"
        :showSpinner="true"
        :loadingMessage="initialPreviewMessage"
      )

  div(v-else-if="step === 'results'").relative-position.full-width
    .row.items-center.z-top.bg-blur.full-width(style="position:sticky; top:50px; margin-bottom:12px;")
      .centered.full-width
        .row.q-ml-lg
          q-btn(flat icon="refresh" label="Start again" :size="isDesktop? 'lg':'md'" no-caps @click="startAgain")
          q-btn(color="primary" square icon="group" label="More Looks" :size="isDesktop? 'lg':'md'" no-caps @click="openMoreLooks")
          q-btn(flat icon="home_repair_service" label="Advanced" :size="isDesktop? 'lg':'md'" no-caps @click="goToCreatePage")
          q-btn(flat icon="sym_o_acute" label="Magic Mirror Fast" :size="isDesktop? 'lg':'md'" no-caps @click="$router.push({ name: 'magicMirrorBanana' })")
    .centered.q-mt-sm.q-ma-md.q-pa-md(v-if="showTemplatePreview")
      MagicPreviewGrid(
        :templates="currentPreviewTemplates"
        :skeletonCount="previewSkeletonCount"
        :loadingMessage="previewLoadingMessage"
        :isDesktop="isDesktop"
        :gender="genderForTemplates || 'female'"
        :showSpinner="true"

      )

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

  q-dialog(v-model="loginDialogOpen" :maximized="!isDesktop")
    q-card(:style="isDesktop ? 'width:520px; max-width:100vw;' : 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Login or Register
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mt-sm
          p.text-primary Please login or register to use Magic Mirror Pro.
        PrivyLogin
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
  q-dialog(v-model="insufficientDialogOpen" :maximized="!isDesktop")
    q-card(:style="isDesktop ? 'width:720px; max-width:95vw;' : 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Not enough points for Magic Mirror Pro
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mb-sm
          p You need {{ mmRequiredPoints }} Fiddl Points to use Magic Mirror Pro (training set + model + 3 images).
          p You have {{ availablePoints }} points. Missing {{ missingPoints }} points.
        .row.q-col-gutter-md.items-stretch
          .col-12.col-sm-6.flex
            q-card(flat bordered class="option-card cursor-pointer fit" @click="goToMMFast")
              q-card-section.option-body
                .row.items-center.justify-between
                  .row.items-center.no-wrap
                    q-icon(name="flash_on" color="amber-5" size="28px").q-mr-sm
                    .text-h6.text-weight-medium Magic Mirror Fast
                  q-chip(color="primary" text-color="white" dense outline) {{ bananaCost }} pts
                .text-body2.q-mt-xs.text-grey-5 Start in seconds. No training required.
                .text-body2.text-grey-5 Great for first-time users and quick results.
                .row.q-ml-sm.q-mt-sm
                  q-chip(color="grey-8" text-color="white") Uses Seedream 4 + Nano Banana
                .q-mt-sm
                  .text-body2.text-grey-5 For 3 looks (6 images): {{ fastCostFor3 }} pts (save ~{{ estimatedSavings }} vs Pro)
              q-separator
              q-card-actions(align="right")
                q-btn(label="Use Fast" color="primary" size="lg" icon="flash_on" no-caps @click.stop="goToMMFast")

          .col-12.col-sm-6.flex
            q-card(flat bordered class="option-card fit")
              q-card-section.option-body
                .row.items-center.justify-between
                  .row.items-center.no-wrap
                    q-icon(name="auto_awesome" color="deep-purple-4" size="28px").q-mr-sm
                    .text-h6.text-weight-medium Magic Mirror Pro
                  q-chip(color="secondary" text-color="white" dense outline) Need +{{ missingPoints }} pts
                .text-body2.q-mt-xs.text-grey-5 Best quality and most creative control.
                .text-body2.text-grey-5 Uses a personalized model; takes longer to set up.
                .row.q-ml-sm.q-mt-sm
                  q-chip(color="grey-8" text-color="white") Uses Custom Flux Model
                .q-mt-sm
                  QuickBuyPointsDialog(@paymentComplete="onBuyMiniComplete")
              q-separator
              q-card-actions(align="right")
                q-btn(color="secondary" label="Add Points" size="lg" icon="add" no-caps @click="goToAddPoints")
      q-card-actions(align="right")
        q-btn(flat label="Close" v-close-popup)
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

  q-dialog(v-model="animateDialogOpen" :maximized="!isDesktop")
    q-card(:style="isDesktop ? 'width:520px; max-width:100vw;' : 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Animate Image
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .centered.q-mb-md
          q-img(
            v-if="animateDialogImageId"
            :src="img(animateDialogImageId, 'md')"
            fit="contain"
            style="max-height:60vh; max-height:60dvh; width:100%; background:black;"
          )
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

  // Quick purchase dialog for insufficient credits on animation
  q-dialog(v-model="quickBuyDialogOpen" :maximized="!isDesktop")
    q-card(:style="isDesktop ? 'width:520px; max-width:100vw;' : 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Add Fiddl Points
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        QuickBuyPointsDialog(@paymentComplete="onQuickBuyComplete")

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
import MagicPreviewGrid from "src/components/magic/MagicPreviewGrid.vue"
import PromptTemplatesPicker from "src/components/magic/PromptTemplatesPicker.vue"
import PrivyLogin from "src/components/dialogs/PrivyLogin.vue"
// Replaced inline mini with reusable QuickBuyPointsDialog
import QuickBuyPointsDialog from "src/components/dialogs/QuickBuyPointsDialog.vue"
import { type MediaGalleryMeta } from "src/components/MediaGallery.vue"
import SimpleMediaGrid, { type Item } from "src/components/magic/SimpleMediaGrid.vue"
import { img } from "lib/netlifyImg"
import { createMagicTrainingSet } from "src/lib/magic/magicTrainingSet"
import { scheduleMagicRenders } from "src/lib/magic/magicApi"
import { modelsCreateModel, modelsGetCustomModel, modelsGetTrainingStatus, trainingSetsDescribeSet, trainingSetsGetSet, createBatchStatus } from "lib/orval"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useRouter } from "vue-router"
import { type Gender, type PromptTemplate, type GenderedPromptTemplate } from "src/lib/promptTemplates"
import { useMagicTemplateSelection } from "src/lib/magic/useMagicTemplateSelection"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"
import { catchErr } from "lib/util"
import { toCreatePage } from "lib/routeHelpers"
import { prices } from "src/stores/pricesStore"
import { magicMirrorProTotalPoints, magicMirrorFastTotalPoints, applyPrivateTax } from "src/lib/magic/magicCosts"
import { useMagicMirrorResults } from "src/lib/magic/useMagicMirrorResults"

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
// Nudge dialog for signup post-results
const signupNudgeOpen = ref(false)
let signupTimer: number | null = null
const mmRequiredPoints = computed(() => magicMirrorProTotalPoints())
const availablePoints = computed(() => userAuth.userData?.availablePoints || 0)
const missingPoints = computed(() => Math.max(0, mmRequiredPoints.value - availablePoints.value))
// Magic Mirror Fast per-look cost (Seedream 4 + Nano Banana)
const bananaCost = computed(() => {
  const sd = prices.image?.model?.["seedream4"]
  const nb = prices.image?.model?.["nano-banana"]
  const safe = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
  return applyPrivateTax(safe(sd)) + applyPrivateTax(safe(nb))
})
const fastCostFor3 = computed(() => magicMirrorFastTotalPoints())
const estimatedSavings = computed(() => Math.max(0, mmRequiredPoints.value - fastCostFor3.value))

const generatingMore = ref(false)
const generatedImageIds = ref<string[]>([])

const trainingSetId = ref<string | null>(null)
const customModelId = ref<string | null>(null)
const trainingStatus = ref<string>("processing")
const trainingProgress = ref<number>(0)
// Upload/training-set creation phase (pre-model) UI state
const trainingPhaseMessage = ref<string>("Preparing photos…")
const trainingPhasePct = ref<number | null>(null)
const trainingGender = ref<string | null>(null)
const elapsedTime = ref<string>("0:00")
const remainingTime = ref<string>("0:00")
let pollTimer: number | null = null
let creationsPollTimer: number | null = null
let batchStatusTimer: number | null = null
const scheduled = ref(false)
const scheduledAt = ref<number | null>(null)
const pendingBaselineIds = ref<string[]>([])
// Track batch IDs started in this Magic Mirror Pro session
const activeBatchIds = ref<string[]>([])

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

const additionalLoadingTemplates = ref<string[]>([])
const initialLoadingTemplates = ref<string[]>([])
const pendingNewCount = ref<number>(0)
const lastKnownIds = ref<string[]>([])
const isWaitingForImages = ref(false)

const SESSION_KEY = "mmState"
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
  quickBuyDialogOpen,
} = useMagicMirrorResults({ animatedKey: "mmAnimatedVideoIds", router })

const genderForTemplates = computed<Gender | null>(() => {
  const g = (trainingGender.value || "").toLowerCase()
  if (g === "male" || g === "female") return g as Gender
  if (g === "unknown") return "female"
  return null
})

// Shared template selection logic
const rawTemplates = computed<GenderedPromptTemplate[]>(() => promptTplStore.templates as unknown as GenderedPromptTemplate[])
const { dialogOpen, dialogSelection, dialogMode, selectedTemplates, templatesConfirmed, displayTemplates, templatesById, getTemplateByAnyId, selectedTemplateObjs, openTemplatesDialog } = useMagicTemplateSelection({ genderForTemplates, rawTemplates })

// initial preview helper message
const initialPreviewMessage = computed(() => (trainingStatus.value !== "succeeded" ? "Training your model..." : "Generating your images..."))

// templatesPreviewGridStyle handled by MagicPreviewGrid

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

// previewGridStyle handled by MagicPreviewGrid

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
const isMobile = computed(() => quasar.platform.is.mobile)
const mediaObjects = computed<Item[]>(() => generatedImageIds.value.map((id) => ({ id, url: img(id, "lg"), type: "image" })))

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
    activeBatchIds: activeBatchIds.value,
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
    if (Array.isArray(data.activeBatchIds)) activeBatchIds.value = data.activeBatchIds
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
    trainingPhaseMessage.value = "Preparing photos…"
    trainingPhasePct.value = null
    const { trainingSetId: tsid } = await createMagicTrainingSet(blobs, {
      onStage: (stage) => {
        const msg = stage === "zip" ? "Preparing photos…" : stage === "create" ? "Creating training set…" : stage === "uploadZip" ? "Uploading photos…" : stage === "thumbnails" ? "Uploading thumbnails…" : stage === "finalize" ? "Finalizing training set…" : "Working…"
        trainingPhaseMessage.value = msg
        // Only show overlay for long operations; keep reactive UI in-page
        Loading.show({ message: msg })
      },
      onProgress: (pct) => {
        trainingPhasePct.value = pct
        Loading.show({ message: `Uploading… ${pct}%` })
      },
    })
    trainingSetId.value = tsid
    saveSession()
    // Resolve gender/subject as early as possible and let the user pick looks now
    await ensureTrainingSetGenderLoaded()
    step.value = "selectTemplates"
    saveSession()
    void nextTick(() => openTemplatesDialog("initial"))
    // Kick off model training in the background and start polling
    void startTraining()
  } catch (e: any) {
    catchErr(e)
    step.value = "capture"
  } finally {
    Loading.hide()
  }
}
function onCaptureError(reason: string) {
  // catchErr(new Error("Capture error: " + reason))
  quasar.notify({ color: "negative", message: "Capture error: " + reason })
}

function onAuthRequired() {
  // Open login dialog inline to keep user on the page
  loginDialogOpen.value = true
}

function onInsufficientPoints() {
  quasar.notify({ color: "negative", message: "Not enough Fiddl Points to start Magic Mirror Pro" })
  insufficientDialogOpen.value = true
}
function onBuyMiniComplete() {
  insufficientDialogOpen.value = false
  void userAuth.loadUserData()
  quasar.notify({ color: "positive", message: "Points added. Continue with Magic Mirror." })
}

function goToAddPoints() {
  insufficientDialogOpen.value = false
  void router.push({ name: "addPoints" })
}
function goToMMFast() {
  insufficientDialogOpen.value = false
  void router.push({ name: "magicMirrorBanana" })
}

function generateModelName() {
  const base = "MagicMirror-" + Date.now().toString(36).slice(-5)
  return base.slice(0, 28)
}

async function startTraining() {
  if (!trainingSetId.value) return
  try {
    Loading.show({ message: "Starting training..." })
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
    // Step/dialog may already be open; don't disrupt if so
    if (step.value !== "selectTemplates") step.value = "selectTemplates"
    saveSession()
    void userAuth.loadUserData()
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
    const batchId = await scheduleMagicRenders({
      customModelId: customModelId.value,
      templates,
      subjectDescription: subjectDescription ?? "",
    })
    scheduled.value = true
    scheduledAt.value = Date.now()
    saveSession()
    void userAuth.loadUserData()
    startCreationsPoll()
    if (batchId) {
      // record this batch id for session filtering
      activeBatchIds.value = Array.from(new Set([...(activeBatchIds.value || []), batchId]))
      saveSession()
      startBatchStatusWatch(batchId)
    }
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

    // Restrict to requests belonging to batches started in this session
    const allowedReqIds = await collectFinishedRequestIdsForActiveBatches()
    const ids: string[] = []
    for (const req of imageCreations.creations) {
      if (!allowedReqIds.has((req as any).id)) continue
      for (const id of req.mediaIds) if (!ids.includes(id)) ids.push(id)
    }

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

function maybeStartSignupNudge() {
  if (signupTimer || userAuth.userProfile?.email) return
  signupTimer = window.setTimeout(() => {
    if (!userAuth.userProfile?.email) signupNudgeOpen.value = true
  }, 20000)
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

// Gather finished image request ids for batches in this session and prune completed batches
async function collectFinishedRequestIdsForActiveBatches(): Promise<Set<string>> {
  const finished = new Set<string>()
  if (!activeBatchIds.value.length) return finished
  try {
    const results = await Promise.all(
      activeBatchIds.value.map(async (bid) => {
        try {
          const { data: batch } = await createBatchStatus({ batchId: bid })
          return { bid, batch }
        } catch {
          return { bid, batch: null as any }
        }
      }),
    )
    const stillActive: string[] = []
    for (const { bid, batch } of results) {
      if (!batch) continue
      for (const job of batch.jobs || []) {
        if (job?.type === 'image' && job?.status === 'finished' && job?.imageRequestId) {
          finished.add(job.imageRequestId)
        }
      }
      const allDone = (batch.counts?.finished || 0) + (batch.counts?.failed || 0) >= (batch.counts?.total || 0)
      if (!allDone && batch.status !== 'completed' && batch.status !== 'error') {
        stillActive.push(bid)
      }
    }
    if (stillActive.length !== activeBatchIds.value.length) {
      activeBatchIds.value = stillActive
      saveSession()
    }
  } catch {}
  return finished
}

function startAgain() {
  stopTrainingPoll()
  stopCreationsPoll()
  selectedTemplates.value = []
  generatedImageIds.value = []
  activeBatchIds.value = []
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

// share/download/animate provided by useMagicMirrorResults

function scrollToTopSmooth() {
  try {
    const el: any = document.scrollingElement || document.documentElement || document.body
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: 0, behavior: "smooth" })
    else window.scrollTo({ top: 0, behavior: "smooth" })
    const page = document.querySelector(".q-page") as HTMLElement | null
    if (page) page.scrollIntoView({ behavior: "smooth", block: "start" })
  } catch {}
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
    const batchId = await scheduleMagicRenders({ customModelId: customModelId.value, templates, subjectDescription: subjectDescription ?? "" })
    quasar.notify({ color: "primary", message: `Rendering ${templates.length} new looks…` })
    if (!creationsPollTimer) startCreationsPoll()
    if (batchId) {
      activeBatchIds.value = Array.from(new Set([...(activeBatchIds.value || []), batchId]))
      saveSession()
      startBatchStatusWatch(batchId)
    }
    void userAuth.loadUserData()
  } catch (e: any) {
    catchErr(e)
    generatingMore.value = false
    additionalLoadingTemplates.value = []
  }
}

onMounted(() => {
  void loadSession()
  void promptTplStore.loadSubjectFaceTemplates()
})
onBeforeUnmount(() => {
  stopTrainingPoll()
  stopCreationsPoll()
  stopAnimPromptCountdown()
  stopBatchStatusWatch()
  if (signupTimer) window.clearTimeout(signupTimer)
})

function onQuickBuyComplete() {
  quickBuyDialogOpen.value = false
  void userAuth.loadUserData()
  quasar.notify({ color: "positive", message: "Points added. You can animate now." })
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
/* Removed legacy .slot-actions absolute styling. Actions are handled by MediaGallery. */
/* Let MediaGallery handle actions overlay without reserving extra space */
/* Removed bottom padding that created empty space below images on mobile */
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

/* Option cards matching MagicMirrorDialog */
.option-card {
  transition: transform 80ms ease, box-shadow 80ms ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.option-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}
.option-body {
  flex: 1 1 auto;
}
</style>
