<template lang="pug">
  q-form.create-form.col.fit(@submit.prevent="startCreateKeyboard()")
    component(:is="scrollWrapperComponent" :class="{'form-scroll':$q.screen.lt.md}")
      .centered.relative-position
        q-input(
          v-model="req.prompt"
          style="resize:none;"
          :disable="createStore.anyLoading"
          @keydown.enter.prevent="startCreateKeyboard()"
          color="primary"
          filled
          type="textarea"
          placeholder="Enter a description of the image to create"
          :autogrow="$q.screen.lt.md"
        ).full-width
        .absolute-bottom-right(style="margin-bottom:30px; margin-right:30px;")
          q-btn(icon="clear" flat @click="req.prompt = ''" :disable="createStore.anyLoading" round)
          q-tooltip(v-if="$q.screen.gt.sm") Clear Prompt

      .centered.q-ma-md.q-pt-md
        q-btn(icon="lightbulb" flat @click="createStore.newPrompt()" :loading="loading.new" :disable="createStore.anyLoading").q-mr-md
          .badge-sm {{ prices.promptTools.randomPrompt }}
          q-tooltip
            p Generate a new prompt
        q-btn(icon="shuffle" flat @click="createStore.randomizePrompt()" :loading="loading.randomize" :disable="createStore.anyLoading || req.prompt?.length < 10").q-mr-md
          .badge-sm {{ prices.promptTools.randomPrompt }}
          q-tooltip
            p Randomize an element of the prompt
        q-btn(icon="arrow_upward" flat @click="createStore.improvePrompt()" :loading="loading.improve" :disable="createStore.anyLoading || req.prompt?.length < 10").q-mr-md
          .badge-sm {{ prices.promptTools.improvePrompt }}
          q-tooltip
            p Improve the prompt
        q-btn(icon="dashboard_customize" flat @click="openTemplates" :disable="createStore.anyLoading")
          q-tooltip(v-if="$q.screen.gt.sm")
            p Browse Templates

      q-separator(color="grey-9" spaced="20px" inset)
      .centered.settings-grid
        .row.q-col-gutter-md.full-width.items-start
          .col-12.col-md-3
            p.setting-label Aspect Ratio
            q-select(
              v-if="!isNanoBanana"
              v-model="createStore.state.req.aspectRatio"
              :options="createStore.availableAspectRatios"
              style="font-size:20px;"
              :disable="createStore.anyLoading"
              dense
            )
            q-badge.q-mt-xs(v-else color="grey-7" label="Aspect ratio fixed by model")
          .col-12.col-md-3(v-if="req.seed != undefined")
            p.setting-label Seed
            .row.items-start.no-wrap.q-gutter-sm
              q-input.col(
                v-model.number="req.seed"
                type="number"
                placeholder="Random"
                clearable
                :disable="createStore.anyLoading"
                dense
              )
              .column.col-shrink
                q-btn(size="sm" icon="add" flat round @click="req.seed++" :disable="!req.seed")
                q-btn(size="sm" icon="remove" flat round @click="req.seed--" :disable="!req.seed")
          div.relative-position.col-12.col-md-6.full-width
            p.setting-label Model
            // Keep selector on its own row
            q-select.relative-position.text-capitalize(
              v-model="req.model"
              :options="createStore.availableModels"
              style="font-size:20px; min-width:140px; max-width:220px;"
              :disable="createStore.anyLoading"
              dense
            )
              .badge-sm.text-white {{ createStore.selectedModelPrice }}
            // Custom model name shown below selector
            .custom-model-card.row.items-center.no-wrap.q-mt-sm(v-if="req.model === 'custom'")
              q-icon(name="category" size="16px" class="q-mr-sm")
              div.custom-model-name {{ req.customModelName || 'Pick a custom model' }}
              q-space
              q-btn(flat round dense icon="list" no-caps label="Change" @click="showModelPicker = true")
              q-tooltip(v-if="req.customModelName") {{ req.customModelName }}
            // Model pickers: public vs private
            .row.q-mt-md.no-wrap
              .col-auto
                q-btn.q-mr-sm(@click="$router.push({ name: 'models' ,params:{filterTag:'Image'}})" no-caps outline color="primary" icon="list" label="Public Models")
              .col-6
                q-btn(@click="showModelPicker = true" no-caps outline color="primary" icon="category" label="Private Models")

      .row.items-start.wrap.q-col-gutter-md

        // Reference / input images section
        div.relative-position.col-12.col-md-6.q-mt-md(v-if="supportsInputImages")
          p.setting-label.q-ml-md {{ supportsMulti ? 'Input Images' : 'Input Image' }}
          // Thumbnails
          div(v-if="supportsMulti")
            .row.q-gutter-sm.q-mb-sm
              q-chip(v-for="id in selectedImageIds" :key="id" removable @remove="removeImage(id)" color="grey-9" text-color="white")
                q-avatar(size="32px")
                  q-img(:src="s3Img('uploads/' + id)" style="width:32px; height:32px; object-fit:cover;")
                //- span.q-ml-sm {{ shortId(id) }}
            .row.items-center.q-gutter-sm
              q-btn(flat color="primary" icon="add" :label="selectedImageIds.length ? 'Add more' : 'Add images'" @click="openImagesDialog")
              q-badge(v-if="selectedImageIds.length" color="grey-7") {{ selectedImageIds.length }}/{{ maxMulti }}
              q-btn(v-if="selectedImageIds.length" flat color="secondary" icon="clear" label="Clear" @click="clearImages")
          div(v-else)
            q-img.q-mb-sm.q-mt-xs(v-if="selectedImageIds[0]" :src="s3Img('uploads/' + selectedImageIds[0])" style="max-height:160px; min-width:100px;")
            .row.items-center.q-gutter-sm
              q-btn(flat color="primary" icon="photo_library" :label="selectedImageIds[0] ? 'Change image' : 'Choose image'" @click="openImagesDialog")
              q-btn(v-if="selectedImageIds[0]" flat color="secondary" icon="clear" label="Clear" @click="clearImages")

    .full-width(style="height:30px;").gt-sm
    CreateActionBar(
      v-if="$userAuth.userData"
      :publicCost="createStore.publicTotalCost"
      :privateCost="createStore.privateTotalCost"
      :disabled="createDisabled"
      :loadingCreate="loading.create"
      :currentPublic="req.public"
      :showBackBtn="showBackBtnComputed"
      :extraDisabled="actionCooldown"
      :onCreate="startCreateImage"
      caption="Public creations appear in the community feed."
      kind="image"
      @back="$emit('back')"
    )
  q-dialog(v-model="showModelPicker")
    q-card
      .q-ma-md
        .row
          h5.q-mb-sm Select a custom model
          .col-grow
          q-btn(icon="add" label="create new model" flat color="primary" @click="$router.push({name:'forge', params:{mode:'create'}})")
        q-separator(color="primary").q-mb-lg
        CustomModelsList(@modelClicked="setCustomModel" trainedOnly)

  q-dialog(v-model="templatesDialogOpen" :maximized="$q.screen.lt.md")
    PromptTemplatesDialog(
      @apply="applyResolvedPrompt"
      @close="templatesDialogOpen = false"
    )

  // Uploaded images dialog
  UploadedImagesDialog(
    v-model="showImagesDialog"
    :multiSelect="supportsMulti"
    :max="maxMulti"
    :thumbSizeMobile="95"
    context="image"
    :preselectedIds="selectedImageIds"
    @accept="onImagesAccepted"
  )

  // Quick purchase dialog when insufficient points
  q-dialog(v-model="quickBuyDialogOpen" :maximized="$q.screen.lt.md")
    q-card(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;' : 'width:520px; max-width:100vw;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Add Fiddl Points
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mb-sm
          p You need {{ missingPoints }} more points to create these images. Purchase a points package below. Your balance updates automatically after payment.
        QuickBuyPointsDialog(@paymentComplete="onQuickBuyComplete")
  </template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import CustomModelsList from "./CustomModelsList.vue"
import { type CustomModel } from "lib/api"
import { useQuasar } from "quasar"
import { prices } from "stores/pricesStore"
import { useUserAuth } from "src/stores/userAuth"
import PromptTemplatesDialog from "src/components/dialogs/PromptTemplatesDialog.vue"
import UploadedImagesDialog from "src/components/dialogs/UploadedImagesDialog.vue"
import { s3Img } from "lib/netlifyImg"
import QuickBuyPointsDialog from "src/components/dialogs/QuickBuyPointsDialog.vue"
import CreateActionBar from "src/components/CreateActionBar.vue"

const emit = defineEmits(["created", "back"])
const props = defineProps<{ showBackBtn?: boolean }>()
const $q = useQuasar()

const createStore = useCreateImageStore()
const creationsStore = useImageCreations()
const userAuth = useUserAuth()

const req = createStore.state.req
const loading = createStore.state.loading

const createDisabled = computed(() => createStore.anyLoading || (req.prompt?.length || 0) < 5)
const showBackBtnComputed = computed(() => props.showBackBtn ?? $q.screen.lt.md)

const showModelPicker = ref(false)
const templatesDialogOpen = ref(false)
const showImagesDialog = ref(false)
const quickBuyDialogOpen = ref(false)
const actionCooldown = ref(false)

async function startCreateKeyboard() {
  const started = await startCreateImage()
  if (started) {
    const cost = (req.public ?? true) ? createStore.publicTotalCost : createStore.privateTotalCost
    $q.notify({ color: "positive", message: `Starting image creation ${req.public ? "(Public)" : "(Private)"} · ${cost} points` })
    actionCooldown.value = true
    setTimeout(() => (actionCooldown.value = false), 2000)
  }
}

const isNanoBanana = computed(() => req.model === "nano-banana")
const supportsMulti = computed(() => ["nano-banana", "gpt-image-1"].includes(req.model))
const supportsSingle = computed(() => ["flux-dev", "flux-pro", "flux-pro-ultra", "photon", "custom"].includes(req.model))
const supportsInputImages = computed(() => supportsMulti.value || supportsSingle.value)
const maxMulti = 10
const selectedImageIds = computed<string[]>({
  get: () => req.uploadedStartImageIds || [],
  set: (val) => (req.uploadedStartImageIds = val),
})

function openTemplates() {
  templatesDialogOpen.value = true
}

function applyResolvedPrompt(payload: { prompt: string; negativePrompt?: string }) {
  req.prompt = payload.prompt || ""
  // If you want to wire negativePrompt later to req.negativePrompt, do so here
  templatesDialogOpen.value = false
}

async function startCreateImage(isPublic: boolean = req.public ?? true) {
  if (createDisabled.value) return false
  req.public = isPublic
  const targetCost = isPublic ? createStore.publicTotalCost : createStore.privateTotalCost
  const available = userAuth.userData?.availablePoints || 0
  if (targetCost > available) {
    quickBuyDialogOpen.value = true
    return false
  }
  if (req.model === "custom" && !req.customModelId) {
    $q.notify({ type: "warning", message: "Please select a custom model before creating." })
    showModelPicker.value = true
    return false
  }
  void createStore.createImage().then(() => emit("created"))
  return true
}
const scrollWrapperComponent = computed(() => ($q.screen.lt.md ? "q-scroll-area" : "div"))
function setCustomModel(model: CustomModel) {
  showModelPicker.value = false
  req.model = "custom"
  req.customModelId = model.id
  req.customModelName = model.name
  createStore.state.customModel = model
  void creationsStore.setCustomModelId(model.id, useUserAuth().userId || undefined)
  creationsStore.filter.model = "custom"
  creationsStore.filter.customModelId = model.id
  // this.activeCreationsStore.searchCreations(this.$userAuth.userId)

  // creationsStore.searchCreations()
}

function openImagesDialog() {
  if (supportsInputImages.value) showImagesDialog.value = true
}

function onImagesAccepted(ids: string[]) {
  if (supportsMulti.value) {
    // Enforce max and uniqueness
    const merged = [...(req.uploadedStartImageIds || [])]
    for (const id of ids) {
      if (merged.length >= maxMulti) break
      if (!merged.includes(id)) merged.push(id)
    }
    req.uploadedStartImageIds = merged
  } else if (supportsSingle.value) {
    req.uploadedStartImageIds = ids[0] ? [ids[0]] : []
  }
}

function clearImages() {
  req.uploadedStartImageIds = []
}

function removeImage(id: string) {
  req.uploadedStartImageIds = (req.uploadedStartImageIds || []).filter((x) => x !== id)
}

function shortId(id: string) {
  return id.slice(0, 6)
}

watch(
  () => req.model,
  (model) => {
    // Aspect ratio not selectable for nano-banana
    if (model === "nano-banana") req.aspectRatio = undefined as any

    // Adjust selected images when model changes
    if (!supportsInputImages.value) req.uploadedStartImageIds = []
    else if (supportsSingle.value && (req.uploadedStartImageIds?.length || 0) > 1) req.uploadedStartImageIds = [req.uploadedStartImageIds![0]!]
    else if (supportsMulti.value && (req.uploadedStartImageIds?.length || 0) > maxMulti) req.uploadedStartImageIds = req.uploadedStartImageIds!.slice(0, maxMulti)
  },
  { immediate: true },
)

const missingPoints = computed(() => {
  const available = userAuth.userData?.availablePoints || 0
  return Math.max(0, createStore.totalCost - available)
})

function onQuickBuyComplete() {
  quickBuyDialogOpen.value = false
  void useUserAuth().loadUserData()
  $q.notify({ color: "positive", message: "Points added. You can create now." })
}
</script>

<style scoped>
textarea::-webkit-resizer {
  display: none;
}

.create-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  /* Prevent tiny horizontal overflow from gutter/margins */
  overflow-x: hidden;
}

.settings-grid {
  width: 100%;
}

.setting-label {
  font-size: 12px;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  height: 700px;
}
@media (max-width: 1000px) {
  .form-scroll {
    height: calc(100vh - 150px);
    height: calc(100dvh - 150px);
  }
}

/* New layout improvements */
.custom-model-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  min-height: 36px;
}
.custom-model-card .ellipsis {
  min-width: 0;
}
.custom-model-name {
  min-width: 0;
  white-space: normal;
  word-break: break-word;
  overflow: visible;
}
</style>
