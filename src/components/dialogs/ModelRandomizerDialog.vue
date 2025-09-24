<template lang="pug">
q-card(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0; overflow:auto;' : 'width:820px; max-width:95vw; max-height:85vh; overflow:auto;'")
  // Header
  q-card-section.z-top.bg-grey-10(style="position:sticky; top:0; z-index:10;")
    .row.items-center.justify-between
      h6.q-mt-none.q-mb-none Model Picker & Randomizer
      q-btn(flat dense round icon="close" @click="emit('close')")
    q-separator
  // Content (card scrolls; header/actions are sticky)
  q-card-section
    .sticky-controls.bg-grey-10(style="position:sticky; top:56px; z-index:10;")
      .row.q-col-gutter-md
        .col-12.col-md-6
          p.setting-label Mode
          q-btn-toggle(v-model="local.mode" :options="modeOptions" toggle-color="primary" glossy)
        .col-6.col-md-3(v-if="local.mode === 'random'")
          p.setting-label Picks per create
          q-input(type="number" v-model.number="local.picksCount" min="1" max="8" dense filled)
        .col-6.col-md-3(v-if="local.mode === 'random'")
          p.setting-label Max budget (pts)
          q-input(type="number" v-model.number="local.maxBudget" min="1" dense filled)
        .col-12(v-if="local.mode === 'random'")
          q-toggle(v-model="local.excludeExpensive" color="primary" label="Exclude expensive models (default)")
          .text-caption.text-grey-5.q-mt-xs Random picks will avoid expensive models when enabled.
      q-separator

    // Manual selection list only when mode is manual
    template(v-if="local.mode === 'manual'")
      q-separator(spaced color="grey-9")
      .row.items-center.q-mb-sm
        h6.q-mt-none.q-mb-none Pick Models
        q-space
        // Manual mode helpers
        q-btn(flat dense icon="select_all" label="Select All" @click="selectAllManual()")
        q-btn(flat dense color="secondary" icon="clear_all" label="Clear" @click="clearManual()")
        q-btn(flat dense icon="refresh" label="Reload" @click="reload()")
      div(v-if="loading")
        .centered.q-pa-md
          q-spinner-dots(color="primary" size="24px")
      .model-grid(v-else)
        SimpleModelCard(
          v-for="m in displayModels"
          :key="m.slug"
          :model="m"
          :selected="isSelectedSlug(m.slug)"
          :price="priceOfSlug(m.slug)"
          showCheckbox
          :checked="isSelectedSlug(m.slug)"
          @update:checked="onCheckSlug(m.slug, $event)"
          @click="toggleSlug(m.slug)"
        )

  q-separator
  // Sticky actions at bottom
  q-card-actions.z-top.bg-grey-10(align="between" style="position:sticky; bottom:0; z-index:10;")
    .text-caption.text-grey-5
      | Estimated public cost:
      strong {{ estimatedPublic }}
      |  · Private:
      strong {{ estimatedPrivate }}
    .row.q-gutter-sm
      q-btn(flat color="secondary" label="Cancel" @click="emit('close')")
      q-btn(color="primary" label="Save" @click="save()")
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useQuasar } from "quasar"
import { useCreateImageStore } from "src/stores/createImageStore"
import * as modelsStore from "src/stores/modelsStore"
import type { ImageModel } from "src/lib/imageModels"
import { prices } from "src/stores/pricesStore"

const emit = defineEmits(["close"])

const $q = useQuasar()
const store = useCreateImageStore()

const modeOptions = [
  { label: "Random", value: "random" },
  { label: "Manual", value: "manual" },
]

// Use store state directly for reactive sharing with ImageForm
const local = reactive({
  get mode() {
    return store.state.randomizer.mode as "random" | "manual"
  },
  set mode(v: "random" | "manual") {
    store.state.randomizer.mode = v as any
  },
  get picksCount() {
    return store.state.randomizer.picksCount
  },
  set picksCount(v: number) {
    store.state.randomizer.picksCount = Math.max(1, Math.min(8, Number(v) || 1))
  },
  get maxBudget() {
    return store.state.randomizer.maxBudget
  },
  set maxBudget(v: number) {
    store.state.randomizer.maxBudget = Math.max(1, Number(v) || 1)
  },
  get excludeExpensive() {
    return store.state.randomizer.excludeExpensive
  },
  set excludeExpensive(v: boolean) {
    store.state.randomizer.excludeExpensive = !!v
  },
}) as any

const displayModels = computed(() => {
  // Only base models with slugs present in the app's imageModels list (excluding 'custom')
  const base = modelsStore.models.base || []
  const allowed = new Set<string>([...store.availableModels].filter((m) => m !== "custom"))
  return base.filter((m) => allowed.has(m.slug))
})

const loading = ref(false)
async function reload() {
  loading.value = true
  try {
    await modelsStore.loadAllModels()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void reload()
  // If we land in manual mode with nothing picked, preselect 3 models
  if (local.mode === "manual") ensureDefaultManualSelection()
})

// No checkbox map needed when deriving selection from store

function isSelectedSlug(slug: string): boolean {
  return (store.state.randomizer.manualSelection || []).includes(slug as any)
}

function toggleSlug(slug: string) {
  const list = store.state.randomizer.manualSelection || []
  const idx = list.indexOf(slug as any)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(slug as any)
}

function onCheckSlug(slug: string, checked: boolean) {
  const list = store.state.randomizer.manualSelection || []
  const idx = list.indexOf(slug as any)
  if (checked && idx < 0) list.push(slug as any)
  if (!checked && idx >= 0) list.splice(idx, 1)
}

function shortDesc(text?: string | null): string {
  if (!text) return ""
  const t = String(text)
  return t.length > 120 ? t.slice(0, 117) + "…" : t
}

function priceOfSlug(slug: string): number {
  return store.priceForModel(slug as ImageModel)
}

const privateRate = computed(() => {
  const p = prices.privateTax
  return typeof p === "number" && Number.isFinite(p) ? Math.max(0, p) / 100 : 0.05
})
// Mirror ImageForm cost display by using store's computed totals
const estimatedPublic = computed(() => (store.state.randomizer.enabled ? store.publicTotalCostMulti : store.publicTotalCost))
const estimatedPrivate = computed(() => (store.state.randomizer.enabled ? store.privateTotalCostMulti : store.privateTotalCost))

// Ensure at least some defaults are chosen when entering manual mode
function ensureDefaultManualSelection() {
  const list = store.state.randomizer.manualSelection || []
  if (list.length > 0) return
  // Prefer models visible in this dialog; fall back to all available
  const candidates = (displayModels.value?.length
    ? displayModels.value.map((m) => m.slug)
    : (store.availableModels || []).filter((m: string) => m !== "custom")) as string[]
  // Sort by ascending price so defaults are affordable
  const sorted = [...candidates].sort((a, b) => priceOfSlug(a) - priceOfSlug(b))
  const pick = sorted.slice(0, 3) as ImageModel[]
  store.state.randomizer.manualSelection = pick
}

// React when switching modes inside the dialog
watch(
  () => local.mode,
  (mode) => {
    if (mode === "manual") ensureDefaultManualSelection()
  },
)

function selectAllManual() {
  const all = (displayModels.value || []).map((m) => m.slug) as ImageModel[]
  store.state.randomizer.manualSelection = all
}

function clearManual() {
  store.state.randomizer.manualSelection = [] as any
}

function save() {
  // In manual mode, require at least one model
  if (local.mode === "manual") {
    const count = (store.state.randomizer.manualSelection || []).length
    if (count < 1) {
      $q.notify({ type: "negative", message: "Select at least one model before saving" })
      return
    }
  }
  store.saveRandomizer()
  $q.notify({ color: "positive", message: "Randomizer settings saved" })
  emit("close")
}

// no scrollAreaStyle needed when card handles overflow
import SimpleModelCard from "src/components/SimpleModelCard.vue"
</script>

<style scoped>
.setting-label {
  font-size: 12px;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

</style>
