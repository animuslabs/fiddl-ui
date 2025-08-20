<template lang="pug">
q-card(style="width:980px; max-width:100vw;")
  q-card-section.z-top.bg-grey-10(style="position:sticky; top:0; z-index:10;")
    .row.items-center.justify-between
      h6.q-mt-none.q-mb-none Browse Templates
      q-btn(flat dense round icon="close" @click="$emit('close')")
    .row.items-center.justify-between.q-mt-sm
      q-tabs(v-model="activeTab" dense active-color="primary" indicator-color="primary")
        q-tab(name="subject" label="Subject")
        //- q-tab(name="setting" label="Setting")
        //- q-tab(name="style" label="Style")
        //- q-tab(name="mood" label="Mood")
      q-btn-toggle(v-if="isSubjectTab" v-model="genderMode" :options="genderOptions" flat unelevated color="grey" toggle-color="primary")
    q-separator
  q-card-section
    q-tab-panels(v-model="activeTab" animated)
      q-tab-panel(v-for="k in kinds" :key="k" :name="k")
        div(v-if="slotFor(k).loading" class="centered q-pa-md")
          q-spinner-dots(color="primary" size="24px")
        div(v-else-if="slotFor(k).error" class="q-pa-md")
          p.text-negative {{ slotFor(k).error }}
        div(v-else-if="isSubjectTab")
          //- h4 hi
          div(v-if="genderMode === 'split'")
            .row.q-col-gutter-md
              .col-12.col-md-6
                h6.text-grey-5.q-mb-sm Female
                .template-grid(:style="gridStyle")
                  .template-item(v-for="t in resolved(k, 'female')" :key="t.id" :style="itemStyle(t)")
                    PromptTemplateCard(:template="t" :gender="'female'" :ratio="aspectOf(t) || undefined" @click="applyTemplate(t)")
              .col-12.col-md-6
                h6.text-grey-5.q-mb-sm Male
                .template-grid(:style="gridStyle")
                  .template-item(v-for="t in resolved(k, 'male')" :key="t.id" :style="itemStyle(t)")
                    PromptTemplateCard(:template="t" :gender="'male'" :ratio="aspectOf(t) || undefined" @click="applyTemplate(t)")
          div(v-else)
            .template-grid(:style="gridStyle")
              .template-item(v-for="t in resolved(k, genderForList)" :key="t.id" :style="itemStyle(t)")
                PromptTemplateCard(:template="t" :gender="genderForList" :ratio="aspectOf(t) || undefined" @click="applyTemplate(t)")
        div(v-else)
          .template-grid(:style="gridStyle")
            .template-item(v-for="t in resolved(k, genderForList)" :key="t.id" :style="itemStyle(t)")
              PromptTemplateCard(:template="t" :gender="genderForList" :ratio="aspectOf(t) || undefined" @click="applyTemplate(t)")
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import { resolveGenderedTemplates, promptFromTemplates, type TemplateKind, type PromptTemplate, type Gender } from "src/lib/promptTemplates"
import { useQuasar } from "quasar"

const emit = defineEmits<{
  (e: "apply", payload: { prompt: string; negativePrompt?: string }): void
  (e: "close"): void
}>()

const quasar = useQuasar()
const store = usePromptTemplatesStore()

const kinds: TemplateKind[] = ["subject", "setting", "style", "mood"]
const activeTab = ref<TemplateKind>("subject")
const genderMode = ref<"female" | "male" | "split">("split")
const genderOptions = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "Split", value: "split" },
]

const isSubjectTab = computed(() => activeTab.value === "subject")

// responsive grid: 4 cols on mobile, auto-fit on larger screens
const gridStyle = computed(() => {
  if (quasar.screen.lt.md) {
    return {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "6px",
      width: "100%",
    }
  }
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    width: "100%",
  }
})

function slotFor(kind: TemplateKind) {
  return store.byKind[kind]
}

const genderForList = computed<Gender>(() => (isSubjectTab.value ? (genderMode.value === "male" ? "male" : "female") : "female"))

function resolved(kind: TemplateKind, gender: Gender): PromptTemplate[] {
  const slot = slotFor(kind)
  return resolveGenderedTemplates(slot.items || [], gender)
}

// lightweight aspect cache to detect wide images for 2-col span on mobile
const aspects = ref<Record<string, number>>({})

function previewUrlOf(t: PromptTemplate): string {
  const anyT: any = t
  return anyT.previewUrl || ""
}

function ensureAspect(t: PromptTemplate) {
  const id = t.id
  if (aspects.value[id]) return
  const url = previewUrlOf(t)
  if (!url) return
  const img = new Image()
  img.onload = () => {
    aspects.value[id] = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
  }
  img.onerror = () => {
    aspects.value[id] = 1
  }
  img.src = url
}

function aspectOf(t: PromptTemplate): number | undefined {
  ensureAspect(t)
  return aspects.value[t.id]
}

function itemStyle(t: PromptTemplate): Record<string, string> {
  if (!quasar.screen.lt.md) return {}
  const a = aspectOf(t) || 0
  // span 2 columns on mobile when notably wide
  return a > 1.35 ? { gridColumnEnd: "span 2" } : {}
}

async function ensureLoaded(kind: TemplateKind) {
  await store.loadByKind(kind)
}

onMounted(() => {
  void ensureLoaded(activeTab.value)
})

watch(activeTab, (k) => {
  // Force-refresh on tab change so we always query when switching tabs
  void store.loadByKind(k, true)
})

function applyTemplate(t: PromptTemplate) {
  const r = promptFromTemplates([t])
  emit("apply", { prompt: r.prompt, negativePrompt: r.negativePrompt })
}
</script>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  justify-items: center;
  width: 100%;
  max-width: 100%;
}
.template-item {
  width: 100%;
  min-width: 0;
}
</style>
