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
      h5 Training your model...
      p This usually takes 5–45 minutes. You can safely leave and come back.
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
    .centered
      h5 Choose 3 looks
      p.text-secondary We'll render these as soon as training completes
    .centered.q-mt-sm(v-if="trainingStatus !== 'succeeded'")
      p.text-secondary Training in background — {{ trainingStatus }} {{ trainingProgress }}%
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
    .centered.q-mt-md
      q-btn(
        color="primary"
        label="Confirm Choices"
        :disable="selectedTemplates.length !== 3 || templatesConfirmed"
        @click="confirmTemplates"
        no-caps
      )
    .centered.q-mt-sm(v-if="templatesConfirmed")
      p Your images are being prepared. We’ll email you when they’re ready.
      q-spinner-grid(color="primary" size="50px").q-mt-sm
  //- Step: Results
  div(v-else-if="step === 'results'")
    .centered.q-mt-lg
      h5 Your images are ready
    div(v-if="generatedImageIds.length > 0" style="width:100%")
      MagicResultsViewer(:image-ids="generatedImageIds")
    div(v-else class="centered q-pa-lg")
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
import { createMagicTrainingSet } from "src/lib/magic/magicTrainingSet"
import { scheduleMagicRenders } from "src/lib/magic/magicApi"
import { modelsCreateModel, modelsGetCustomModel, modelsGetTrainingStatus, trainingSetsDescribeSet, trainingSetsGetSet } from "lib/orval"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useRouter } from "vue-router"
import { type Gender, resolveGenderedTemplates } from "src/lib/promptTemplates"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"

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
    console.error(e)
    quasar.notify({ message: e?.message || "Failed to prepare training set", color: "negative" })
    step.value = "capture"
  } finally {
    Loading.hide()
  }
}

function onCaptureError(reason: string) {
  quasar.notify({ message: "Capture error: " + reason, color: "negative" })
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
    console.error(e)
    quasar.notify({ message: e?.message || "Failed to start training", color: "negative" })
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
    console.error(e)
    quasar.notify({ message: e?.message || "Failed to schedule images", color: "negative" })
  } finally {
    Loading.hide()
  }
}

function startCreationsPoll() {
  stopCreationsPoll()
  const poll = async () => {
    if (!customModelId.value) return
    imageCreations.filter.model = "custom"
    imageCreations.filter.customModelId = customModelId.value
    imageCreations.searchCreations(userAuth.userId || undefined)
    await nextTick()
    const cutoff = scheduledAt.value ? new Date(scheduledAt.value) : null
    const ids: string[] = []
    for (const req of imageCreations.creations) {
      if (cutoff && req.createdAt < cutoff) continue
      for (const id of req.mediaIds) {
        if (!ids.includes(id)) ids.push(id)
      }
    }
    generatedImageIds.value = ids.slice(0, 16)
    if (generatedImageIds.value.length >= 3) {
      step.value = "results"
      saveSession()
      stopCreationsPoll()
      return
    }
    creationsPollTimer = window.setTimeout(poll, 10000)
  }
  void poll()
}

function stopCreationsPoll() {
  if (creationsPollTimer) window.clearTimeout(creationsPollTimer)
  creationsPollTimer = null
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
</style>
