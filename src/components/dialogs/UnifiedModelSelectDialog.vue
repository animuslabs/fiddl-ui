<template lang="pug">
q-card(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0; overflow:auto;' : 'width:900px; max-width:95vw; max-height:90vh; overflow:auto;'")
  // Header
  q-card-section.z-top.bg-grey-10(style="position:sticky; top:0; z-index:10;")
    .row.items-center.no-wrap
      h6.q-mt-none.q-mb-none Select Model(s)
      q-space
      q-btn(flat dense round icon="close" @click="emit('close')")
    q-separator
    .row.q-col-gutter-md.items-center.q-mt-sm
      .col-auto
        q-btn-toggle(v-model="mode" :options="modeOptions" toggle-color="primary" glossy)
      .col
        q-tabs(v-if="mode !== 'random'" v-model="tab" dense narrow-indicator class="text-grey-5" active-color="white" indicator-color="secondary")
          q-tab(name="base" :label="tabLabelBase")
          q-tab(name="custom" :label="tabLabelCustom")
  // Content
  q-card-section
    // Random mode options only
    template(v-if="mode === 'random'")
      .row.q-col-gutter-md
        .col-6.col-md-3
          p.setting-label Picks per create
          q-input(type="number" v-model.number="rnd.picksCount" min="1" max="8" dense filled)
        .col-6.col-md-3
          p.setting-label Max budget (pts)
          q-input(type="number" v-model.number="rnd.maxBudget" min="1" dense filled)
        .col-12
          q-toggle(v-model="rnd.excludeExpensive" color="primary" label="Exclude expensive models")
      q-separator(spaced color="grey-9")
      .text-caption.text-grey-5
        | Estimated public: {{ estimatedPublic }} · Private: {{ estimatedPrivate }}
    // Single/Multi: show lists
    q-tab-panels(v-else v-model="tab" animated)
      q-tab-panel(name="base")
        div
          div(v-if="loading.base")
            .centered.q-pa-md
              q-spinner-dots(color="primary" size="24px")
          .model-grid(v-else :key="baseGridKey")
            SimpleModelCard(
              v-for="m in baseModels"
              :key="m.slug"
              :model="m"
              :price="priceOfSlug(m.slug)"
              :selected="isBaseSelected(m.slug)"
              @click="onClickBase(m.slug)"
            )
          // Sticky bottom-right controls (only meaningful in multi)
          .sticky-fab(v-if="mode==='multi'")
            .fab-right
              q-btn(class="fab-btn" push color="primary" icon="select_all" label="Select All" size="md" @click="selectAllBase()" :disable="loading.base")
              q-btn(class="fab-btn" push color="secondary" icon="clear_all" label="Clear" size="md" @click="clearBase()" :disable="loading.base")
      q-tab-panel(name="custom")
        div
          div(v-if="loading.custom")
            .centered.q-pa-md
              q-spinner-dots(color="primary" size="24px")
          template(v-else)
            .text-grey-5.q-mb-sm(v-if="myCustomModels.length === 0") No custom models found.
            .model-grid(:key="customGridKey")
              SimpleModelCard(
                v-for="m in myCustomModels"
                :key="m.id"
                :model="m"
                :price="priceOfCustom(m)"
                :selected="isCustomSelected(m.id)"
                @click="onClickCustom(m.id)"
              )
          .sticky-fab
            .fab-right
              q-btn(class="fab-btn" push color="grey-8" text-color="white" icon="refresh" label="Reload" size="md" @click="reloadCustom()" :disable="loading.custom")
              q-btn(v-if="mode==='multi'" class="fab-btn" push color="primary" icon="select_all" label="Select All" size="md" @click="selectAllCustom()" :disable="loading.custom")
              q-btn(v-if="mode==='multi'" class="fab-btn" push color="secondary" icon="clear_all" label="Clear" size="md" @click="clearCustom()" :disable="loading.custom")

  q-separator
  // Actions
  q-card-actions.z-top.bg-grey-10(align="right" style="position:sticky; bottom:0; z-index:10;")
    .text-caption.text-grey-5.q-mr-md
      template(v-if="mode==='single'")
        | {{ singleSummary }}
      template(v-else-if="mode==='multi'")
        | {{ multiSummary }}
      template(v-else)
        | Random: picks {{ rnd.picksCount }}, budget {{ rnd.maxBudget }}
    q-btn(flat color="secondary" label="Cancel" @click="emit('close')")
    q-btn(color="primary" label="Save" @click="save()")
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useCreateImageStore } from 'src/stores/createImageStore'
import * as modelsStore from 'src/stores/modelsStore'
import { useUserAuth } from 'src/stores/userAuth'
import SimpleModelCard from 'src/components/SimpleModelCard.vue'
import type { ImageModel } from 'src/lib/imageModels'
import { prices } from 'src/stores/pricesStore'

const emit = defineEmits(['close'])
const $q = useQuasar()
const store = useCreateImageStore()
const auth = useUserAuth()

const tab = ref<'base'|'custom'>('base')
const modeOptions = [
  { label: 'Single', value: 'single' },
  { label: 'Multi', value: 'multi' },
  { label: 'Random', value: 'random' },
]

const mode = ref<'single'|'multi'|'random'>(store.state.randomizer.enabled ? (store.state.randomizer.mode === 'random' ? 'random' : 'multi') : 'single')

// Local selection state
const local = reactive({
  baseSingle: (store.state.req.model !== 'custom' ? (store.state.req.model as ImageModel) : null) as ImageModel | null,
  customSingle: (store.state.req.model === 'custom' ? (store.state.req.customModelId || null) : null) as string | null,
  baseMulti: [...(store.state.randomizer.manualSelection || [])] as ImageModel[],
  customMulti: [...(store.state.randomizer.manualCustomIds || [])] as string[],
})

const loading = reactive({ base: false, custom: false })
const baseGridKey = ref(0)
const customGridKey = ref(0)

const baseModels = computed(() => {
  const base = modelsStore.models.base || []
  const allowed = new Set<string>([...store.availableModels].filter((m) => m !== 'custom'))
  return base.filter((m) => allowed.has(m.slug))
})

const myCustomModels = computed(() => modelsStore.models.userModels || [])

function priceOfSlug(slug: string): number {
  return store.priceForModel(slug as ImageModel)
}
function priceOfCustom(model: any): number {
  let base: ImageModel = 'flux-dev'
  const t = String(model?.modelType || '')
  if (t === 'fluxPro') base = 'flux-pro' as ImageModel
  else if (t === 'fluxProUltra') base = 'flux-pro-ultra' as ImageModel
  return store.priceForModel(base) + (prices.forge?.customModelCharge || 0)
}

// Selection helpers
function isBaseSelected(slug: string): boolean {
  return mode.value === 'multi' ? local.baseMulti.includes(slug as any) : local.baseSingle === (slug as any)
}
function onClickBase(slug: string) {
  if (mode.value === 'multi') {
    const list = local.baseMulti
    const idx = list.indexOf(slug as any)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(slug as any)
  } else {
    local.baseSingle = slug as any
    local.customSingle = null
    // Instant accept in single mode
    save()
  }
}

function isCustomSelected(id: string): boolean {
  return mode.value === 'multi' ? local.customMulti.includes(id) : local.customSingle === id
}
function onClickCustom(id: string) {
  if (mode.value === 'multi') {
    const list = local.customMulti
    const idx = list.indexOf(id)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(id)
  } else {
    local.customSingle = id
    local.baseSingle = null
    // Instant accept in single mode
    save()
  }
}

function selectAllCustom() {
  const all = (myCustomModels.value || []).map((m) => m.id!)
  local.customMulti.splice(0, local.customMulti.length, ...all)
  customGridKey.value++
  // force ref change for reactivity edge-cases
  // @ts-ignore
  local.customMulti = [...local.customMulti]
}
function clearCustom() {
  local.customMulti.splice(0, local.customMulti.length)
  customGridKey.value++
  // @ts-ignore
  local.customMulti = []
}
function selectAllBase() {
  const all = (baseModels.value || []).map((m) => m.slug) as any
  local.baseMulti.splice(0, local.baseMulti.length, ...all)
  baseGridKey.value++
  // @ts-ignore
  local.baseMulti = [...local.baseMulti]
}
function clearBase() {
  local.baseMulti.splice(0, local.baseMulti.length)
  baseGridKey.value++
  // @ts-ignore
  local.baseMulti = []
}

const singleSummary = computed(() => {
  if (local.customSingle) return 'Custom model selected'
  if (local.baseSingle) return String(local.baseSingle)
  return 'No model selected'
})
const multiSummary = computed(() => `${local.baseMulti.length + local.customMulti.length} selected`)

// Tab labels with counters (only meaningful in Multi)
const tabLabelBase = computed(() => mode.value === 'multi' ? `Models (${local.baseMulti.length})` : 'Models')
const tabLabelCustom = computed(() => mode.value === 'multi' ? `My Custom Models (${local.customMulti.length})` : 'My Custom Models')

async function reloadBase() {
  loading.base = true
  try { await modelsStore.loadAllModels() } finally { loading.base = false }
}
async function reloadCustom() {
  loading.custom = true
  try {
    if (auth.userId) await modelsStore.loadUserModels(auth.userId)
  } finally { loading.custom = false }
}

onMounted(() => {
  if ((modelsStore.models.base || []).length === 0) void reloadBase()
  if ((modelsStore.models.userModels || []).length === 0 && auth.userId) void reloadCustom()
})

function save() {
  if (mode.value === 'single') {
    // Require a choice
    if (!local.baseSingle && !local.customSingle) {
      $q.notify({ type: 'warning', message: 'Pick a model' })
      return
    }
    store.state.randomizer.enabled = false
    if (local.customSingle) {
      store.state.req.model = 'custom'
      store.state.req.customModelId = local.customSingle
    } else if (local.baseSingle) {
      store.state.req.model = local.baseSingle as ImageModel
      store.state.req.customModelId = undefined
    }
    // Clear any multi selections
    store.state.randomizer.manualSelection = [] as any
    ;(store.state.randomizer as any).manualCustomIds = []
    store.saveRandomizer()
  } else if (mode.value === 'multi') {
    if ((local.baseMulti.length + local.customMulti.length) === 0) {
      $q.notify({ type: 'negative', message: 'Select at least one model' })
      return
    }
    store.state.randomizer.enabled = true
    store.state.randomizer.mode = 'manual' as any
    store.state.randomizer.manualSelection = [...local.baseMulti] as any
    ;(store.state.randomizer as any).manualCustomIds = [...local.customMulti]
    store.saveRandomizer()
  } else {
    // Random
    store.state.randomizer.enabled = true
    store.state.randomizer.mode = 'random' as any
    // Clear manual selections
    store.state.randomizer.manualSelection = [] as any
    ;(store.state.randomizer as any).manualCustomIds = []
    store.saveRandomizer()
  }
  emit('close')
}

// Randomizer local proxy (directly bound to store for simplicity)
const rnd = reactive({
  get picksCount() { return store.state.randomizer.picksCount },
  set picksCount(v: number) { store.state.randomizer.picksCount = Math.max(1, Math.min(8, Number(v) || 1)) },
  get maxBudget() { return store.state.randomizer.maxBudget },
  set maxBudget(v: number) { store.state.randomizer.maxBudget = Math.max(1, Number(v) || 1) },
  get excludeExpensive() { return store.state.randomizer.excludeExpensive },
  set excludeExpensive(v: boolean) { store.state.randomizer.excludeExpensive = !!v },
}) as any

function localManualPublicCost(): number {
  // Sum base models
  let sum = (local.baseMulti || []).reduce((acc, slug) => acc + store.priceForModel(slug as ImageModel), 0)
  // Add custom models (base price + surcharge)
  for (const id of local.customMulti || []) {
    const found = (modelsStore.models.userModels || []).find((m: any) => m.id === id) || (modelsStore.models.custom || []).find((m: any) => m.id === id)
    let base: ImageModel = 'flux-dev'
    switch (String(found?.modelType || '')) {
      case 'fluxPro': base = 'flux-pro' as ImageModel; break
      case 'fluxProUltra': base = 'flux-pro-ultra' as ImageModel; break
      default: base = 'flux-dev' as ImageModel
    }
    sum += store.priceForModel(base) + (prices.forge?.customModelCharge || 0)
  }
  return sum
}
const estimatedPublic = computed(() => (mode.value === 'random' ? store.publicTotalCostMulti : (mode.value === 'multi' ? localManualPublicCost() : store.publicTotalCost)))
const estimatedPrivate = computed(() => {
  const base = estimatedPublic.value
  const rate = (store.privateTaxRate as any).value ?? store.privateTaxRate
  const premium = Math.ceil(base * (typeof rate === 'number' ? rate : 0.05))
  return base + premium
})
</script>

<style scoped>
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}
.sticky-fab {
  position: sticky;
  bottom: 8px;
  z-index: 12;
  display: flex;
  justify-content: flex-end;
  pointer-events: none; /* allow scroll-through */
}
.fab-right {
  display: flex;
  gap: 8px;
  pointer-events: auto; /* re-enable on buttons */
}
.fab-btn {
  border-radius: 9999px;
}
</style>
