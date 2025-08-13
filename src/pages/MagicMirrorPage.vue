<template lang="pug">
q-page.full-width
  .centered.q-mt-md
    h2 Magic Mirror
  .centered.q-ma-md
    p.text-primary Transform your selfie into different characters in minutes
  div(v-if="sessionLoaded && step === 'capture'")
    .centered
      MagicMirrorCamera(@captured="onCaptured" @error="onCaptureError")
  div(v-else-if="step === 'training'")
  div(v-else-if="step === 'selectTemplates'")
    .centered(v-if="!templatesConfirmed")
      h4 Choose 3 looks
    .centered.q-mt-sm(v-if="trainingStatus !== 'succeeded'")
      p.text-primary {{ trainingStatus }} {{ trainingProgress }}%
      q-linear-progress(:value="trainingProgress/100" stripe size="10px" color="primary" class="q-mt-xs")
    //- Email link banner
    .centered.q-mt-sm(v-if="!userAuth.userProfile?.email")
      q-banner(dense class="bg-grey-10 text-white" style="max-width:600px;")
        div Link your email to get a notification when results are ready
        q-btn(flat color="primary" label="Link Email" class="q-ml-sm" @click="goLinkEmail" no-caps)
        q-btn(flat color="primary" label="Login" class="q-ml-sm" @click="openLogin" no-caps)
    .centered.q-mt-sm(v-if="!templatesConfirmed")
      q-btn(color="primary" label="Pick Looks" no-caps @click="openTemplatesDialog('initial')")
    //- Preview the three chosen templates while waiting for training
    .centered.q-mt-md(v-if="templatesConfirmed && trainingStatus !== 'succeeded'")
      .full-width.q-mx-auto.preview-flex-center(style="max-width:720px")
        .template-preview-grid(:style="templatesPreviewGridStyle")
          .template-item(v-for="t in selectedTemplateObjs" :key="t.id")
            .template-card-box
              PromptTemplateCard(:template="t" :gender="genderForTemplates || 'female'" :selectable="false")
  div(v-else-if="step === 'results'").relative-position.full-width
    .row.items-center.z-top.bg-blur.full-width(style="position:sticky; top:50px;")
      .centered.col-12.full-width
        q-btn(flat icon="refresh" label="Start again" :size="isDesktop? 'lg':'md'" no-caps @click="startAgain")
        q-btn(flat icon="group" label="More Looks" :size="isDesktop? 'lg':'md'" no-caps @click="openMoreLooks")
        q-btn(flat icon="home_repair_service" label="Advanced" :size="isDesktop? 'lg':'md'" no-caps @click="goToCreatePage")
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
            .row.items-center.justify-center.q-gutter-sm.q-pt-sm.bg-black.q-pa-md
              q-btn(flat size="sm"  icon="share" label="Share"  no-caps @click="shareImage(media.id)")
              q-btn(flat size="sm"  icon="download" label="Download"  no-caps @click="downloadImage(media.id)")
              q-btn(flat size="sm"  icon="movie" label="Animate" no-caps @click="animateImage(media.id)")
                q-tooltip(v-if="triggeredVideoIds.includes(media.id)") Animation already triggered

    // Centered loading placeholder while waiting for initial images
    div.full-width.column.items-center.justify-center.bg-blur(v-else style="min-height: 55vh;")
      q-spinner-grid(color="primary" size="50px")
      p.text-secondary.q-mt-sm Generating your images...

  q-dialog(v-model="dialogOpen")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Pick looks
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        PromptTemplatesPicker(
          :gender="genderForTemplates"
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

  .bg-blur.q-pa-lg.full-width( v-if="isWaitingForImages || generatingMore" style="position:fixed; bottom:100px;")
    .centered
      p.q-mb-md Your images will be ready shortly.
    .centered
      q-spinner-grid(color="primary" size="50px")

  // Floating video prompt after animation trigger
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
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from "vue"
import { useQuasar, Loading } from "quasar"
import { useUserAuth } from "src/stores/userAuth"
import MagicMirrorCamera from "src/components/magic/MagicMirrorCamera.vue"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import MagicResultsViewer from "src/components/magic/MagicResultsViewer.vue"
import PromptTemplatesPicker from "src/components/magic/PromptTemplatesPicker.vue"
import MediaGallery, { type MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { img } from "lib/netlifyImg"
import { createMagicTrainingSet } from "src/lib/magic/magicTrainingSet"
import { scheduleMagicRenders } from "src/lib/magic/magicApi"
import { modelsCreateModel, modelsGetCustomModel, modelsGetTrainingStatus, trainingSetsDescribeSet, trainingSetsGetSet } from "lib/orval"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useRouter } from "vue-router"
import { type Gender, resolveGenderedTemplates } from "src/lib/promptTemplates"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"
import { catchErr } from "lib/util"
import { toCreatePage } from "lib/routeHelpers"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { prices } from "src/stores/pricesStore"

type Step = "init" | "capture" | "training" | "selectTemplates" | "results"

const quasar = useQuasar()
const userAuth = useUserAuth()
const createStore = useCreateImageStore()
const imageCreations = useImageCreations()
const router = useRouter()

const step = ref<Step>("init")
const sessionLoaded = ref(false)
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

// Additional results/expansion state
const additionalLoadingTemplates = ref<string[]>([])
const renderedTemplates = ref<string[]>([])
const pendingNewCount = ref<number>(0)
const lastKnownIds = ref<string[]>([])
const isWaitingForImages = ref(false)

const SESSION_KEY = "mmState"

const promptTplStore = usePromptTemplatesStore()

// Video animation dialog state
const vidStore = useCreateVideoStore()
const animateDialogOpen = ref(false)
const animateDialogImageId = ref<string | null>(null)
const animating = ref(false)

// Floating countdown prompt for video navigation
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

// Track which images have had animation triggered to disable repeat
const ANIMATED_KEY = "mmAnimatedVideoIds"
const triggeredVideoIds = ref<string[]>([])
function loadAnimatedIds() {
  try {
    const raw = sessionStorage.getItem(ANIMATED_KEY)
    triggeredVideoIds.value = raw ? JSON.parse(raw) : []
  } catch {
    console.error("sessionLoad error")
  }
}
function saveAnimatedIds() {
  try {
    sessionStorage.setItem(ANIMATED_KEY, JSON.stringify(triggeredVideoIds.value))
  } catch {
    console.error("session setItem error")
  }
}

// Pricing helpers (Kling model)
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

const displayTemplates = computed(() => {
  if (!genderForTemplates.value) return []
  return resolveGenderedTemplates(promptTplStore.templates, genderForTemplates.value)
})

const templatesGridStyle = computed(() => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: "10px",
  justifyContent: "center",
  justifyItems: "center",
}))

const selectedTemplateObjs = computed(() => {
  const byId = new Map(displayTemplates.value.map((t: any) => [t.id, t]))
  return selectedTemplates.value.map((id) => byId.get(id)).filter(Boolean)
})

const templatesPreviewGridStyle = computed(() => {
  const n = selectedTemplateObjs.value.length || 3
  const count = Math.min(3, Math.max(1, n))
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${count}, 180px)`,
    gap: "10px",
    justifyItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
    width: "fit-content",
    maxWidth: "100%",
  }
})

// Results view helpers
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
    step: step.value,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

function loadSession() {
  try {
    console.log("loading session")
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) {
      sessionLoaded.value = true
      step.value = "capture"
      return
    }
    const data = JSON.parse(raw)
    trainingSetId.value = data.trainingSetId || null
    customModelId.value = data.customModelId || null
    if (Array.isArray(data.selectedTemplates)) selectedTemplates.value = data.selectedTemplates
    templatesConfirmed.value = !!data.templatesConfirmed
    scheduled.value = !!data.scheduled
    scheduledAt.value = typeof data.scheduledAt === "number" ? data.scheduledAt : null
    trainingGender.value = data.trainingGender || null
    const sessStep = data.step as typeof step.value | undefined
    if (sessStep) step.value = sessStep
    console.log("here", trainingGender.value)
    if (((trainingSetId.value || customModelId.value) && !trainingGender.value) || trainingGender.value == "unknown") {
      void ensureTrainingSetGenderLoaded()
    }
    if (customModelId.value) {
      startTrainingPoll()
      if (scheduled.value && templatesConfirmed.value) startCreationsPoll()
    }
    sessionLoaded.value = true
  } catch (e) {
    console.warn("failed to load session", e)
  }
}

async function ensureTrainingSetGenderLoaded() {
  try {
    if (trainingGender.value && trainingGender.value != "unknown") return console.log(trainingGender.value)
    // If we don't have a trainingSetId but we do have a customModelId, resolve it
    if (!trainingSetId.value && customModelId.value) {
      const resp = await modelsGetCustomModel({ id: customModelId.value })
      const tsid = resp.data?.trainingSetId || null
      if (tsid) {
        trainingSetId.value = tsid
        saveSession()
      }
    }
    if (!trainingSetId.value) return

    // Prefer describeSet but be defensive about response shape / nulls
    try {
      console.log("called describeset")
      const { data } = await trainingSetsDescribeSet({ trainingSetId: trainingSetId.value })
      if (data && typeof data.subjectGender === "string") {
        trainingGender.value = data.subjectGender || null
        saveSession()
        return
      }
    } catch (e) {
      console.warn("trainingSetsDescribeSet failed, will try getSet as fallback", e)
    }

    // Fallback: use trainingSetsGetSet which may be available in some API versions
    try {
      const { data } = await trainingSetsGetSet({ trainingSetId: trainingSetId.value } as any)
      if (data && typeof data.subjectGender === "string") {
        trainingGender.value = data.subjectGender || null
        saveSession()
        return
      }
    } catch (e) {
      console.warn("trainingSetsGetSet fallback failed", e)
    }
  } catch (e) {
    console.warn("failed to resolve training set gender", e)
  }
}

function openCamera() {
  // Camera component is rendered below; button kept for UX
  const el = document.getElementById("mmVideo")
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
}

function pickFromGallery() {
  // The camera component contains a gallery fallback; this is a helper affordance
  quasar.notify({ message: "Use the Gallery option inside the camera widget", color: "primary" })
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

function generateModelName() {
  const base = "MagicMirror-" + Date.now().toString(36).slice(-5)
  return base.slice(0, 28)
}

function goLinkEmail() {
  try {
    const rt = router.currentRoute.value.fullPath
    sessionStorage.setItem("returnTo", rt)
  } catch {
    console.error()
  }
  void router.push({ name: "login" })
}

function openLogin() {
  try {
    const rt = router.currentRoute.value.fullPath
    sessionStorage.setItem("returnTo", rt)
  } catch {
    console.error()
  }
  void router.push({ name: "login" })
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
    // Allow user to pick templates while training runs
    step.value = "selectTemplates"
    saveSession()
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

/**
 * Template selection is unified via dialog
 * See: openTemplatesDialog / onDialogConfirm
 */

function maybeGenerateIfReady() {
  if (templatesConfirmed.value && trainingStatus.value === "succeeded" && customModelId.value) {
    void scheduleAndPollIfReady()
  }
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
    await scheduleMagicRenders({
      customModelId: customModelId.value,
      templates: displayTemplates.value.filter((el) => selectedTemplates.value.includes(el.id)),
    })

    scheduled.value = true
    scheduledAt.value = Date.now()
    saveSession()
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
    // Configure filters on the store
    imageCreations.filter.model = "custom"
    imageCreations.filter.customModelId = customModelId.value

    // Ensure the store constrains by custom model using its own API
    try {
      if (imageCreations.customModelId !== customModelId.value) {
        await imageCreations.setCustomModelId(customModelId.value, userAuth.userId || undefined)
      } else {
        // Refresh latest page explicitly; clear list to force fresh page fetch and UI update
        imageCreations.creations = []
        await imageCreations.loadCreations(userAuth.userId || undefined)
      }
    } catch (e) {
      console.warn("loadCreations failed", e)
    }

    // Collect image IDs from the refreshed list (store already filtered by model/customModelId)
    const ids: string[] = []
    for (const req of imageCreations.creations) {
      for (const id of req.mediaIds) {
        if (!ids.includes(id)) ids.push(id)
      }
    }

    // Track new arrivals for additional template batches
    const oldSet = new Set(lastKnownIds.value)
    const deltaNew = ids.filter((id) => !oldSet.has(id))

    // Update reactive list and last-known set
    const prevCount = generatedImageIds.value.length
    generatedImageIds.value = ids.slice(0, 16)
    lastKnownIds.value = generatedImageIds.value.slice()

    // If we had queued additional templates, clear their loading state once enough new images arrive
    if (pendingNewCount.value > 0 && deltaNew.length >= pendingNewCount.value) {
      additionalLoadingTemplates.value = []
      pendingNewCount.value = 0
      generatingMore.value = false
    }

    // Update waiting state and scroll when transitioning from waiting -> visible
    const expectingInitial = scheduled.value && generatedImageIds.value.length < 3
    const expectingAdditional = pendingNewCount.value > 0
    const expecting = expectingInitial || expectingAdditional
    if (prevWaiting && !expecting && (deltaNew.length > 0 || prevCount === 0) && generatedImageIds.value.length > 0) {
      void nextTick(() => {
        try {
          scrollToTopSmooth()
        } catch {
          console.error("scroll error")
        }
      })
    }
    isWaitingForImages.value = expecting

    // Wait for the first batch to complete (all three images) before showing results
    if (generatedImageIds.value.length >= 3 && step.value !== "results") {
      step.value = "results"
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

// UX actions
function startAgain() {
  // Clear state and go back to capture
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
  void toCreatePage({ model: "custom", type: "image", customModelId: customModelId.value!, customModelName: "Magic Mirror" }, router)
}

// Per-image actions
async function shareImage(id: string) {
  try {
    const url = img(id, "lg")
    const nav: any = navigator as any
    if (nav && typeof nav.share === "function") {
      await nav.share({
        title: "My Magic Mirror image",
        text: "Check out my Magic Mirror result",
        url,
      })
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
    // Fetch as blob for reliable downloading across browsers/origins
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
    // Prepare a minimal Kling video request seeded by the selected image
    vidStore.setReq({
      prompt: "Animate this image",
      model: "kling",
      aspectRatio: "16:9",
      public: true,
      quantity: 1,
      duration: defaultVideoDuration,
      startImageId: animateDialogImageId.value,
      uploadedStartImageId: undefined,
      seed: undefined,
    } as any)
    await vidStore.createVideoRequest()
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
  void toCreatePage({ model: "kling", type: "video" }, router)
}

// Robust scroll-to-top helper (handles various scroll containers)
function scrollToTopSmooth() {
  try {
    const el: any = document.scrollingElement || document.documentElement || document.body
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
    const page = document.querySelector(".q-page") as HTMLElement | null
    if (page) page.scrollIntoView({ behavior: "smooth", block: "start" })
  } catch {
    console.error("scroll error")
  }
}

/**
 * Templates dialog handlers (unified)
 */
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
    templatesConfirmed.value = true
    saveSession()
    quasar.notify({ message: "Templates saved", color: "primary" })
    dialogOpen.value = false
    maybeGenerateIfReady()
    return
  }
  if (!customModelId.value) return
  const ids = dialogSelection.value.slice()
  if (!ids.length) return
  try {
    generatingMore.value = true
    dialogOpen.value = false
    const byId = new Map(displayTemplates.value.map((t) => [t.id, t]))
    const templates = ids.map((id) => byId.get(id)).filter(Boolean) as any
    if (!templates.length) {
      generatingMore.value = false
      return
    }
    // Track loading state and expected arrivals
    additionalLoadingTemplates.value = [...new Set([...additionalLoadingTemplates.value, ...ids])]
    pendingNewCount.value += templates.length
    await scheduleMagicRenders({
      customModelId: customModelId.value,
      templates,
    })
    if (!creationsPollTimer) startCreationsPoll()
  } catch (e: any) {
    catchErr(e)
    generatingMore.value = false
  }
}

// Trigger more renders for a specific template
async function generateMoreForTemplate(t: any) {
  if (!customModelId.value) return
  if (additionalLoadingTemplates.value.includes(t.id)) return
  try {
    additionalLoadingTemplates.value = [...additionalLoadingTemplates.value, t.id]
    pendingNewCount.value += 1
    await scheduleMagicRenders({
      customModelId: customModelId.value,
      templates: [t],
    })
    // Keep polling running; results handler will clear loading state when new image arrives
    if (!creationsPollTimer) startCreationsPoll()
  } catch (e: any) {
    catchErr(e)
    // rollback loading state
    const idx = additionalLoadingTemplates.value.indexOf(t.id)
    if (idx >= 0) additionalLoadingTemplates.value.splice(idx, 1)
    pendingNewCount.value = Math.max(0, pendingNewCount.value - 1)
  }
}

onMounted(() => {
  // TODO: umami.track('mm_page_open')
  loadSession()
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
.mobile-list {
  padding: 8px 12px 24px;
}

.image-block {
  margin-bottom: 16px;
}

.fit-image {
  width: 100%;
  max-height: calc(100vh - 140px);
  object-fit: contain;
  background: #000;
  border-radius: 8px;
}

.actions-inline {
  padding: 0px 0 0px;
}

.desktop-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 12px;
  padding-bottom: 16px;
}

/* Template grid card sizing/consistency */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important;
  gap: 10px;
  justify-content: center;
  justify-items: center;
  /* Center the grid by shrinking to content width while respecting container */
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}

/* Dedicated preview grid to ensure centering and fixed columns without !important collisions */
.template-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 180px);
  gap: 10px;
  justify-items: center;
  justify-content: center;
  align-content: center;
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.template-card-box {
  /* Keep a consistent shape for template tiles across the grid */
  aspect-ratio: 3 / 4;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  display: block;
}

/* Try to constrain internal card content text from changing tile height */
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

/* Render actions below the image visually by reserving space within each tile */
.slot-actions {
  position: absolute !important;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 6px 4px !important;
  background: transparent !important;
  pointer-events: auto;
}

/* Reserve space for the actions bar inside each MediaGallery tile on this page */
:deep(.media-wrapper) {
  padding-bottom: 48px;
}

/* Shrink media height to make room for the reserved actions area (works for q-img and video) */
:deep(.media-wrapper) > .q-img,
:deep(.media-wrapper) > div > video {
  height: calc(100% - 48px) !important;
}

/* Unify template tile heights in the "Try more looks" grid */
.template-grid > .template-item {
  display: flex;
  flex-direction: column;
}

.template-grid > .template-item .template-card-box {
  flex: 1 1 auto;
  display: block;
}

/* Make inner PromptTemplateCard fill the fixed aspect-ratio box */
.template-grid > .template-item .template-card-box :deep(.template-item) {
  height: 100%;
}

.template-grid > .template-item .template-card-box :deep(.q-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Give the action area a consistent height to normalize total tile height */
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
