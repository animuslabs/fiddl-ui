<template lang="pug">
q-page.q-pa-sm
  .centered.q-mt-md.q-mb-md
    h2 Magic Mirror
    p.text-primary Transform your selfie into different characters in minutes
  div(v-if="step === 'capture'")
    .centered
      MagicMirrorCamera(@captured="onCaptured" @error="onCaptureError")
  div(v-else-if="step === 'training'")
    .centered.q-mt-lg
      //- h5 Training your model...
      //- p This usually takes 5–45 minutes. You can safely leave and come back.
      .full-width(style="max-width:600px")
        h6 Status: {{ trainingStatus }}
        div(v-if="(trainingProgress||0)>0").q-mt-sm
          h4 {{ trainingProgress }}%
          q-linear-progress(:value="trainingProgress/100" stripe size="20px" color="primary" track-color="grey")
          .row.q-gutter-md.q-mt-sm
            div
              h6 Elapsed:
              h4 {{ elapsedTime }}
            .col-grow
            div
              h6 Remaining:
              h4 {{ remainingTime }}
        div(v-else).row.items-center.q-gutter-sm
          q-spinner(color="primary")
          span Training...
  //- Step: Select Templates
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
    //- Template picker
    .q-mt-sm
      .centered(v-if="!promptTplStore.loaded")
        q-spinner(color="primary")
        p.text-secondary.q-mt-xs Loading templates...
      template(v-else)
        .template-grid(:style="templatesGridStyle")
          PromptTemplateCard(
            v-for="t in displayTemplates"
            :key="t.id"
            :template="t"
            :gender="genderForTemplates || 'male'"
            :selectable="!templatesConfirmed"
            :selected="selectedTemplates.includes(t.id)"
            @click="toggleTemplate(t.id)"
          )
    .centered.q-mt-md.bg-blur.q-pa-md.q-mb-xl(style="position:sticky; bottom:70px;")
      div.q-mb-sm(v-if="selectedTemplates.length < 3")
        p Picked {{ selectedTemplates.length }} / 3
      q-btn(
        color="primary"
        label="Confirm Choices"
        :disable="selectedTemplates.length !== 3 || templatesConfirmed"
        @click="confirmTemplates"
        no-caps
        size="lg"
      )
    .absolute-center
      .centered.q-mt-sm.bg-blur.q-pa-xl(v-if="templatesConfirmed")
        p.q-mb-md Your images will be ready shortly.
        q-spinner-grid(color="primary" size="50px").q-mt-sm
  //- Step: Results
  div(v-else-if="step === 'results'").relative-position
    .sticky-actions.row.items-center.q-gutter-sm
      q-btn(flat icon="refresh" label="Start again" no-caps @click="startAgain")
      q-btn(flat icon="home_repair_service" label="Forge" no-caps @click="goToForge")
    // Content
    div(v-if="generatedImageIds.length > 0" style="width:100%")
      // Desktop: mosaic gallery with per-item actions
      MediaGallery.q-pl-md.q-pr-md(
        v-if="isDesktop"
        :mediaObjects="mediaObjects"
        layout="mosaic"
        :rowHeightRatio="1.2"
        :cols-desktop="5"
        :gap="8"
      )
        template(#actions="{ media }")
          .actions-inline.slot-actions.row.items-center.justify-center.q-gutter-sm
            q-btn(flat color="primary" icon="share" label="Share" size="sm" no-caps @click="shareImage(media.id)")
            q-btn(flat color="primary" icon="download" label="Download" size="sm" no-caps @click="downloadImage(media.id)")
            q-btn(flat color="accent" icon="movie" label="Animate" size="sm" no-caps @click="animateImage(media.id)")
      // Mobile: scrollable list of images that fit viewport height
      .mobile-list(v-else)
        .image-block(v-for="id in generatedImageIds" :key="id")
          q-img.fit-image(
            :src="img(id, 'md')"
            spinner-color="white"
            placeholder-src="/blankAvatar.webp"
          )
          .actions-inline.row.items-center.justify-center.q-gutter-sm
            q-btn(flat color="primary" icon="share" label="Share" size="sm" no-caps @click="shareImage(id)")
            q-btn(flat color="primary" icon="download" label="Download" size="sm" no-caps @click="downloadImage(id)")
            q-btn(flat color="accent" icon="movie" label="Animate" size="sm" no-caps @click="animateImage(id)")

      // Unified templates grid (persistent before/after)
      .q-mt-lg.q-pl-md.q-pr-md
        h6 Try more looks
        .template-grid(:style="templatesGridStyle")
          .template-item(v-for="t in displayTemplates" :key="t.id")
            .template-card-box
              PromptTemplateCard(
                :template="t"
                :gender="genderForTemplates || 'male'"
                :selectable="!templatesConfirmed"
                :selected="selectedTemplates.includes(t.id)"
                @click="!templatesConfirmed ? toggleTemplate(t.id) : undefined"
              )
            div.q-mt-xs
              q-btn(
                v-if="templatesConfirmed && !additionalLoadingTemplates.includes(t.id)"
                color="primary"
                flat
                dense
                label="Generate"
                icon="play_arrow"
                no-caps
                @click="generateMoreForTemplate(t)"
              )
              div(v-else-if="templatesConfirmed && additionalLoadingTemplates.includes(t.id)").row.items-center.q-gutter-xs
                q-linear-progress(indeterminate color="primary" size="6px" class="col")
                small.text-secondary Generating...
    div.absolute-center.bg-blur(v-else class="centered q-pa-lg")
      q-spinner-grid(color="primary" size="50px")
      p.text-secondary.q-mt-sm Generating your images...
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from "vue"
import { useQuasar, Loading } from "quasar"
import { useUserAuth } from "src/stores/userAuth"
import MagicMirrorCamera from "src/components/magic/MagicMirrorCamera.vue"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import MagicResultsViewer from "src/components/magic/MagicResultsViewer.vue"
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

type Step = "capture" | "training" | "selectTemplates" | "results"

const quasar = useQuasar()
const userAuth = useUserAuth()
const createStore = useCreateImageStore()
const imageCreations = useImageCreations()
const router = useRouter()

const step = ref<Step>("capture")
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

const SESSION_KEY = "mmState"

const promptTplStore = usePromptTemplatesStore()

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
}))

// Results view helpers
const isDesktop = computed(() => quasar.screen.gt.sm)
const mediaObjects = computed<MediaGalleryMeta[]>(() => generatedImageIds.value.map((id) => ({ id, url: img(id, "md"), type: "image" })))

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
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
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

// Template selection
function toggleTemplate(id: string) {
  if (templatesConfirmed.value) return
  const next = [...selectedTemplates.value]
  const idx = next.indexOf(id)
  if (idx >= 0) next.splice(idx, 1)
  else {
    if (next.length >= 3) return
    next.push(id)
  }
  selectedTemplates.value = next
}

function confirmTemplates() {
  if (selectedTemplates.value.length !== 3) return
  templatesConfirmed.value = true
  saveSession()
  quasar.notify({ message: "Templates saved", color: "primary" })
  // If training already succeeded, try to schedule now; otherwise wait for poll to flip it.
  maybeGenerateIfReady()
}

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
    // Configure filters on the store
    imageCreations.filter.model = "custom"
    imageCreations.filter.customModelId = customModelId.value

    // Ensure the store constrains by custom model using its own API
    try {
      if (imageCreations.customModelId !== customModelId.value) {
        await imageCreations.setCustomModelId(customModelId.value, userAuth.userId || undefined)
      } else {
        // Refresh latest page explicitly
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
    generatedImageIds.value = ids.slice(0, 16)
    lastKnownIds.value = generatedImageIds.value.slice()

    // If we had queued additional templates, clear their loading state once enough new images arrive
    if (pendingNewCount.value > 0 && deltaNew.length >= pendingNewCount.value) {
      additionalLoadingTemplates.value = []
      pendingNewCount.value = 0
    }

    // Wait for the first batch to complete (all three images) before showing results
    if (generatedImageIds.value.length >= 3 && step.value !== "results") {
      step.value = "results"
      saveSession()
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
}

function goToForge() {
  // Take user to Forge landing; they can see/use previous models
  void router.push({ name: "forge", params: { mode: "pick" } })
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
  quasar.notify({ message: "Animate coming soon ✨", color: "accent" })
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
  void promptTplStore.loadSubjectFaceTemplates()
})

onBeforeUnmount(() => {
  stopTrainingPoll()
  stopCreationsPoll()
})
</script>

<style scoped>
.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sticky-actions {
  position: sticky;
  top: 50px;
  z-index: 5;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

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
  padding: 8px 0 4px;
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
</style>
