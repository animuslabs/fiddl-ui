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
        .row.q-col-gutter-md.full-width.items-start.no-wrap
          .col-md-3
            p.setting-label Aspect Ratio
            q-select(
              v-if="!isNanoBanana"
              v-model="createStore.state.req.aspectRatio"
              :options="createStore.availableAspectRatios"
              style="font-size:20px;"
              :disable="createStore.anyLoading"
              dense
            )
              template(#option="{ itemProps, opt, selected }")
                q-item(v-bind="itemProps")
                  q-item-section(avatar)
                    .ar-preview
                      .ar-box(:style="aspectBoxStyle(String(opt))")
                  q-item-section
                    div {{ opt }}
              template(#selected)
                .row.items-center.no-wrap
                  .ar-preview.q-mr-sm
                    .ar-box(:style="aspectBoxStyle(String(createStore.state.req.aspectRatio || '1:1'))")
                  span {{ createStore.state.req.aspectRatio }}
            q-badge.q-mt-xs(v-else color="grey-7" label="N/A")
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
          // Model select moved up to share the row with Aspect Ratio
          div.relative-position.col-grow
            p.setting-label Model
            // Keep selector on its own row
            q-select.relative-position.text-capitalize.model-select(
              ref="modelSelectRef"
              v-model="req.model"
              :options="[]"
              style="font-size:20px; min-width:140px; max-width:220px;"
              :disable="createStore.anyLoading"
              :display-value="modelDisplayText"
              @update:model-value="onModelSelected"
              readonly
              @mousedown.prevent.stop="openModelSelectDialog"
              @keydown.enter.prevent="openModelSelectDialog"
              @keydown.space.prevent="openModelSelectDialog"
              dense
            )
              template(#selected)
                // Custom selected content: single name or scrollable chips for multi/random
                template(v-if="!createStore.state.randomizer.enabled")
                  span {{ modelDisplayText }}
                template(v-else-if="createStore.state.randomizer.mode === 'manual'")
                  .row.items-start.no-wrap
                    .chip-box
                      q-chip(
                        v-for="chip in selectedChipLabels"
                        :key="chip.key"
                        dense
                        color="grey-9"
                        text-color="white"
                        @click.stop
                        @mousedown.stop
                      )
                        span {{ chip.label }}
                        q-icon(name="close" size="12px" class="q-ml-xs cursor-pointer" @click.stop.prevent="removeSelectedChip(chip)")
                    q-badge(v-if="selectedChipLabels.length" color="grey-8" class="q-ml-sm self-start") {{ selectedChipLabels.length }}
                template(v-else)
                  .row.items-start.no-wrap
                    .chip-box
                      q-chip(dense color="grey-9" text-color="white" @click.stop @mousedown.stop)
                        | Random ({{ createStore.state.randomizer.picksCount }})
                      q-chip(dense color="grey-9" text-color="white" @click.stop @mousedown.stop)
                        | Budget {{ createStore.state.randomizer.maxBudget }}
                      q-chip(v-if="createStore.state.randomizer.excludeExpensive" dense color="grey-9" text-color="white" @click.stop @mousedown.stop)
                        | Exclude expensive
              // Hide single-model cost when multi-select/randomizer is enabled
              .badge-sm.text-white(v-if="!createStore.state.randomizer.enabled") {{ createStore.selectedModelPrice }}
            // Custom model name shown below selector
      .row.q-mx-md
        //- Legacy custom-model card removed; chips in the selector show selections
      .row.q-col-gutter-md.full-width.items-start.q-pt-sm
        .col-12
          // Model selection is unified in the selector above; legacy buttons removed
          // Randomizer toggle and config
          //- .row.items-center.q-mt-sm.no-wrap
            q-toggle.q-mr-sm(
              v-model="createStore.state.randomizer.enabled"
              color="primary"
              label="Random models"
              @update:model-value="createStore.saveRandomizer()"
            )
            q-btn(flat dense no-caps icon="tune" label="Configure" @click="randomizerDialogOpen = true")
            q-tooltip(v-if="createStore.state.randomizer.enabled")
              div Picks {{ createStore.state.randomizer.picksCount }} random models per creation.
              div Aspect ratio forced to 16:9, 9:16, or 1:1.

      .row.items-start.wrap.q-col-gutter-md

        // Reference / input images section
        div.relative-position.col-12.q-mt-md(v-if="supportsInputImages")
          p.setting-label.q-ml-md {{ supportsMulti ? 'Input Images' : 'Input Image' }}
          // Thumbnails
          div(v-if="supportsMulti")
            .row.full-width.q-mt-sm.q-pl-md
              StartImageThumbs.q-mb-sm(:items="selectedStartImages" :size="$q.screen.lt.md ? 56 : 64" :gap="8" @remove="removeImage")
            .row.items-center.q-gutter-sm.q-mb-md
              q-btn(flat color="primary" icon="add" :label="selectedStartImages.length ? 'Add more' : 'Add images'" @click="openImagesDialog")
              q-badge(v-if="selectedStartImages.length" color="grey-7") {{ selectedStartImages.length }}/{{ maxMulti }}
              q-btn(v-if="selectedStartImages.length" flat color="secondary" icon="clear" label="Clear" @click="clearImages")
          div(v-else)
            q-img.q-mb-sm.q-mt-xs(v-if="firstSelectedImage" :src="thumbUrl(firstSelectedImage)" fit="contain" :img-style="{ objectFit: 'contain' }" style="max-height:200px; min-width:120px;")
            .row.items-center.q-gutter-sm
              q-btn(flat color="primary" icon="photo_library" :label="firstSelectedImage ? 'Change image' : 'Choose image'" @click="openImagesDialog")
              q-btn(v-if="firstSelectedImage" flat color="secondary" icon="clear" label="Clear" @click="clearImages")

    .full-width(style="height:30px;").gt-sm
    CreateActionBar(
      v-if="$userAuth.userData"
      :publicCost="publicCostToShow"
      :privateCost="privateCostToShow"
      :disabled="createDisabled"
      :loadingCreate="loading.create"
      :currentPublic="req.public"
      :showBackBtn="showBackBtnComputed"
      :extraDisabled="actionCooldown"
      :onCreate="startCreateImage"
      caption="Public creations appear in the community feed."
      kind="image"
      @back="$emit('back')")
  //- Legacy custom models dialog removed (unified picker handles this)

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
    :preselectedIds="preselectedUploadedIds"
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

  // Unified model picker
  q-dialog(v-model="unifiedDialogOpen" :maximized="$q.screen.lt.md")
    UnifiedModelSelectDialog(@close="unifiedDialogOpen = false")
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from "vue"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
// import CustomModelsList from "./CustomModelsList.vue" // legacy
import { useQuasar } from "quasar"
import { prices } from "stores/pricesStore"
import { useUserAuth } from "src/stores/userAuth"
import PromptTemplatesDialog from "src/components/dialogs/PromptTemplatesDialog.vue"
import UploadedImagesDialog from "src/components/dialogs/UploadedImagesDialog.vue"
import { s3Img } from "lib/netlifyImg"
import { compressedUrl } from "lib/imageCdn"
import QuickBuyPointsDialog from "components/dialogs/QuickBuyPointsDialog.vue"
import CreateActionBar from "src/components/CreateActionBar.vue"
import UnifiedModelSelectDialog from "components/dialogs/UnifiedModelSelectDialog.vue"
import * as modelsStore from "stores/modelsStore"
import tma from "src/lib/tmaAnalytics"
import StartImageThumbs from "components/StartImageThumbs.vue"

const emit = defineEmits(["created", "back"])
const props = defineProps<{ showBackBtn?: boolean }>()
const $q = useQuasar()

const createStore = useCreateImageStore()
const creationsStore = useImageCreations()
const userAuth = useUserAuth()

const req = createStore.state.req
const loading = createStore.state.loading

const invalidManualMulti = computed(() => {
  const rnd: any = createStore.state.randomizer
  const baseCount = (rnd?.manualSelection || []).length
  const customCount = (rnd?.manualCustomIds || []).length
  return !!(rnd?.enabled && rnd.mode === "manual" && baseCount + customCount === 0)
})
// Keep create buttons enabled even when multi-select has no picks; we'll block on click with a message.
const createDisabled = computed(() => createStore.anyLoading || (req.prompt?.length || 0) < 5)
const showBackBtnComputed = computed(() => props.showBackBtn ?? $q.screen.lt.md)

// const showModelPicker = ref(false) // legacy
const templatesDialogOpen = ref(false)
const showImagesDialog = ref(false)
const quickBuyDialogOpen = ref(false)
const actionCooldown = ref(false)
const unifiedDialogOpen = ref(false)
const modelSelectRef = ref<any>(null)

// Preload models so the select dialog opens instantly
onMounted(() => {
  if (!modelsStore.models.base.length && !modelsStore.loading.base) {
    void modelsStore.loadAllModels()
  }
})

async function startCreateKeyboard() {
  const started = await startCreateImage()
  if (started) {
    const cost = (req.public ?? true) ? publicCostToShow.value : privateCostToShow.value
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

type StartImageItem = { id: string; source: "uploaded" | "existing" }

const selectedStartImages = computed<StartImageItem[]>(() => {
  const items: StartImageItem[] = []
  const existing = req.startImageIds || []
  for (const id of existing) items.push({ id, source: "existing" })
  const uploaded = req.uploadedStartImageIds || []
  for (const id of uploaded) items.push({ id, source: "uploaded" })
  return items
})

const firstSelectedImage = computed<StartImageItem | null>(() => selectedStartImages.value[0] || null)

const preselectedUploadedIds = computed<string[]>(() => req.uploadedStartImageIds || [])

function thumbUrl(item: StartImageItem): string {
  if (item.source === "uploaded") return s3Img("uploads/" + item.id)
  return compressedUrl(item.id, "md")
}

function openTemplates() {
  templatesDialogOpen.value = true
}

// Multi-select is handled inside UnifiedModelSelectDialog

function applyResolvedPrompt(payload: { prompt: string; negativePrompt?: string }) {
  req.prompt = payload.prompt || ""
  // If you want to wire negativePrompt later to req.negativePrompt, do so here
  templatesDialogOpen.value = false
}

function onModelSelected() {
  // User explicitly chose a single model; exit random/multi mode
  if (createStore.state.randomizer.enabled) {
    createStore.state.randomizer.enabled = false
    createStore.saveRandomizer()
    // Restore dynamic model filtering to current model
    creationsStore.dynamicModel = true
    creationsStore.filter.model = req.model as any
    creationsStore.filter.customModelId = req.model === "custom" ? req.customModelId : undefined
    void creationsStore.searchCreations(userAuth.userId)
  }
}

function onModelSelectedFromDialog(slug: string) {
  req.model = slug as any
  unifiedDialogOpen.value = false
  onModelSelected()
}

function openModelSelectDialog() {
  // Avoid immediate re-opening loops by blurring the faux input
  try {
    modelSelectRef.value?.blur?.()
  } catch {}
  unifiedDialogOpen.value = true
}

const modelDisplayText = computed(() => {
  // If random/multi mode, show special label
  if (modelDisplayValue.value) return modelDisplayValue.value
  // Custom model: show its name if present
  if (req.model === "custom") return req.customModelName || "Custom model"
  // Base model: map slug to friendly name (fallback to slug)
  const m = (modelsStore.models.base || []).find((x) => x.slug === (req.model as any))
  return m?.name || (req.model as string)
})

async function startCreateImage(isPublic: boolean = req.public ?? true) {
  if (createDisabled.value) return false
  req.public = isPublic
  // Guard: manual multi-select enabled but no models picked
  const rnd: any = createStore.state.randomizer
  const baseCount = (rnd?.manualSelection || []).length
  const customCount = (rnd?.manualCustomIds || []).length
  if (rnd?.enabled && rnd.mode === "manual" && baseCount + customCount === 0) {
    $q.notify({ type: "negative", message: "Pick at least one model in Multi-select mode." })
    // Open unified picker to prompt selection
    unifiedDialogOpen.value = true
    return false
  }
  const targetCost = isPublic ? publicCostToShow.value : privateCostToShow.value
  const available = userAuth.userData?.availablePoints || 0
  if (targetCost > available) {
    quickBuyDialogOpen.value = true
    return false
  }
  if (req.model === "custom" && !req.customModelId) {
    $q.notify({ type: "warning", message: "Please select a custom model before creating." })
    unifiedDialogOpen.value = true
    return false
  }
  // When creating in random/multi mode, switch creations filter to show all
  if (createStore.state.randomizer.enabled) {
    creationsStore.dynamicModel = false
    creationsStore.filter.model = undefined as any
    if (creationsStore.filter?.customModelId) creationsStore.filter.customModelId = undefined
    void creationsStore.searchCreations(userAuth.userId)
  }
  // TMA analytics: creation start
  try {
    tma.createStart("image", {
      model: req.model,
      public: !!req.public,
      cost: targetCost,
      randomizer: createStore.state.randomizer?.enabled || false,
      picks: createStore.state.randomizer?.picksCount || null,
    })
  } catch {}

  void createStore.createImage().then(() => {
    try {
      tma.createSuccess("image", { model: req.model, public: !!req.public })
    } catch {}
    emit("created")
  })
  return true
}
const scrollWrapperComponent = computed(() => ($q.screen.lt.md ? "q-scroll-area" : "div"))
// function setCustomModel(model: CustomModel) { /* legacy */ }

function openImagesDialog() {
  if (!supportsInputImages.value) return
  // Guard: enforce max selected images before opening picker
  if (supportsMulti.value) {
    const count = (req.startImageIds?.length || 0) + (req.uploadedStartImageIds?.length || 0)
    if (count >= maxMulti) {
      $q.dialog({
        title: "Max images reached",
        message: `Only ${maxMulti} input images are supported. Please remove some before adding more.`,
      })
      return
    }
  }
  showImagesDialog.value = true
}

function onImagesAccepted(ids: string[]) {
  const currentExisting = req.startImageIds || []
  const currentUploaded = req.uploadedStartImageIds || []
  const existingSet = new Set(currentExisting)
  const uploadedSet = new Set(currentUploaded)
  if (supportsMulti.value) {
    const mergedUploaded = [...currentUploaded]
    const totalCount = () => currentExisting.length + mergedUploaded.length
    for (const id of ids) {
      if (totalCount() >= maxMulti) break
      if (!existingSet.has(id) && !uploadedSet.has(id)) {
        mergedUploaded.push(id)
        uploadedSet.add(id)
      }
    }
    req.uploadedStartImageIds = mergedUploaded
  } else if (supportsSingle.value) {
    // Replace unified selection with the newly picked upload
    req.startImageIds = []
    req.uploadedStartImageIds = ids[0] ? [ids[0]] : []
  }
  // Ensure the image-creation model supports input images by switching to nano-banana
  // This avoids cases where a previously selected model doesn't accept input images
  if (ids && ids.length > 0) {
    req.model = "nano-banana" as any
  }
}

function clearImages() {
  req.uploadedStartImageIds = []
  req.startImageIds = []
}

function removeImage(item: StartImageItem) {
  if (item.source === "uploaded") {
    req.uploadedStartImageIds = (req.uploadedStartImageIds || []).filter((x) => x !== item.id)
  } else {
    req.startImageIds = (req.startImageIds || []).filter((x) => x !== item.id)
  }
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
    const totalCount = (req.startImageIds?.length || 0) + (req.uploadedStartImageIds?.length || 0)
    if (!supportsInputImages.value) {
      req.startImageIds = []
      req.uploadedStartImageIds = []
    } else if (supportsSingle.value) {
      if (totalCount > 1) {
        // Prefer keeping the first existing image if any, otherwise the first uploaded
        const keepExisting = (req.startImageIds || [])[0]
        const keepUploaded = (req.uploadedStartImageIds || [])[0]
        if (keepExisting) {
          req.startImageIds = [keepExisting]
          req.uploadedStartImageIds = []
        } else if (keepUploaded) {
          req.startImageIds = []
          req.uploadedStartImageIds = [keepUploaded]
        } else {
          req.startImageIds = []
          req.uploadedStartImageIds = []
        }
      }
    } else if (supportsMulti.value) {
      if (totalCount > maxMulti) {
        // Trim extras preferring existing first
        const existing = req.startImageIds || []
        const uploaded = req.uploadedStartImageIds || []
        const trimmedExisting = existing.slice(0, Math.min(existing.length, maxMulti))
        const remaining = Math.max(0, maxMulti - trimmedExisting.length)
        const trimmedUploaded = uploaded.slice(0, remaining)
        req.startImageIds = trimmedExisting
        req.uploadedStartImageIds = trimmedUploaded
      }
    }
  },
  { immediate: true },
)

// Keep creations filter synced with random/multi toggle, including on page reload
watch(
  () => createStore.state.randomizer.enabled,
  (enabled) => {
    if (enabled) {
      creationsStore.dynamicModel = false
      creationsStore.filter.model = undefined as any
      creationsStore.filter.customModelId = undefined
    } else {
      creationsStore.dynamicModel = true
      creationsStore.filter.model = req.model as any
      creationsStore.filter.customModelId = req.model === "custom" ? req.customModelId : undefined
    }
    creationsStore.searchCreations(userAuth.userId)
  },
  { immediate: true },
)

const missingPoints = computed(() => {
  const available = userAuth.userData?.availablePoints || 0
  const total = req.public ? publicCostToShow.value : privateCostToShow.value
  return Math.max(0, total - available)
})

// Cost shown respects randomizer settings
const publicCostToShow = computed(() => (createStore.state.randomizer.enabled ? createStore.publicTotalCostMulti : createStore.publicTotalCost))
const privateCostToShow = computed(() => (createStore.state.randomizer.enabled ? createStore.privateTotalCostMulti : createStore.privateTotalCost))

// Display label for model when randomizer is enabled
const modelDisplayValue = computed<string | null>(() => {
  const rnd = createStore.state.randomizer
  if (!rnd.enabled) return null
  if (rnd.mode === "random") {
    const n = Math.max(1, Number(rnd.picksCount) || 1)
    return `Random (${n})`
  }
  const count = (rnd.manualSelection || []).length + ((rnd as any).manualCustomIds?.length || 0)
  return `Multiple (${count})`
})

// Chip display helpers when multi-selected
const selectedChipLabels = computed(() => {
  const rnd = createStore.state.randomizer
  if (!rnd.enabled || rnd.mode !== "manual") return [] as { key: string; label: string }[]
  const list: { key: string; label: string }[] = []
  const base = rnd.manualSelection || []
  for (const slug of base) {
    const m = (modelsStore.models.base || []).find((x) => x.slug === slug)
    list.push({ key: `b-${slug}`, label: m?.name || String(slug) })
  }
  const customIds: string[] = (rnd as any).manualCustomIds || []
  for (const id of customIds) {
    const m = (modelsStore.models.userModels || []).find((x) => x.id === id) || (modelsStore.models.custom || []).find((x) => x.id === id)
    list.push({ key: `c-${id}`, label: m ? `custom: ${m.name}` : "custom model" })
  }
  return list
})
function removeSelectedChip(chip: { key: string; label: string }) {
  const key = chip.key || ''
  const rnd: any = createStore.state.randomizer
  if (!rnd?.enabled || rnd.mode !== 'manual') return
  if (key.startsWith('b-')) {
    const slug = key.slice(2)
    const list: string[] = rnd.manualSelection || []
    const idx = list.indexOf(slug)
    if (idx >= 0) list.splice(idx, 1)
  } else if (key.startsWith('c-')) {
    const id = key.slice(2)
    const list: string[] = rnd.manualCustomIds || []
    const idx = list.indexOf(id)
    if (idx >= 0) list.splice(idx, 1)
  }
  createStore.saveRandomizer()
}

function onQuickBuyComplete() {
  quickBuyDialogOpen.value = false
  void useUserAuth().loadUserData()
  $q.notify({ color: "positive", message: "Points added. You can create now." })
}

// ----- aspect ratio preview helpers -----
function parseAspect(r: string | undefined | null): { w: number; h: number } {
  if (!r) return { w: 1, h: 1 }
  const parts = String(r).split(":").map((n) => Number(n))
  const w = parts[0] && isFinite(parts[0]) ? parts[0] : 1
  const h = parts[1] && isFinite(parts[1]) ? parts[1] : 1
  return { w, h }
}
function aspectBoxStyle(r: string): Record<string, string> {
  const boxW = 34
  const boxH = 22
  const { w, h } = parseAspect(r)
  const scale = Math.min(boxW / Math.max(w, 1), boxH / Math.max(h, 1))
  const innerW = Math.max(6, Math.round(w * scale))
  const innerH = Math.max(6, Math.round(h * scale))
  return { width: `${innerW}px`, height: `${innerH}px` }
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

/* Make the model selector feel like a button (when enabled) */
.model-select:not(.q-field--disabled) {
  cursor: pointer;
}
.model-select:not(.q-field--disabled)::v-deep(.q-field__control),
.model-select:not(.q-field--disabled)::v-deep(.q-field__native),
.model-select:not(.q-field--disabled)::v-deep(.q-field__marginal),
.model-select:not(.q-field--disabled)::v-deep(.q-field__append),
.model-select:not(.q-field--disabled)::v-deep(.q-field__label) {
  cursor: pointer !important;
}

/* Chips box inside the model select */
.chip-box {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 100px;
  overflow-y: auto;
}

/* Aspect ratio previews in selects */
.ar-preview {
  width: 34px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  background: transparent;
}
.ar-box {
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  background: transparent;
}
</style>
