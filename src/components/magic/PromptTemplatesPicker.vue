<template lang="pug">
div
  // Loading state
  .centered(v-if="!tplStore.loaded || tplStore.loading")
    q-spinner(color="primary")
    p.text-secondary.q-mt-xs Loading templates...
  template(v-else)
    .template-grid(:style="gridStyle")
      PromptTemplateCard(
        v-for="t in displayTemplates"
        :key="t.id"
        :template="t"
        :gender="gender || 'male'"
        :selectable="selectable"
        :selected="selectedSet.has(t.id)"
        @click="onTileClick(t.id)"
      )
    div(v-if="showConfirm").centered.q-mt-md.bg-blur.q-pa-md(:style="confirmBarStyle")
      div.q-mb-sm
        p Picked {{ selected.length }} / {{ requiredCountComputed }}
      q-btn(
        color="primary"
        :label="confirmLabel"
        :disable="confirmDisabled"
        @click="emit('confirm')"
        no-caps
        size="lg"
      )
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from "vue"
import { useQuasar } from "quasar"
import type { CSSProperties } from "vue"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import { usePromptTemplatesStore } from "src/stores/promptTemplatesStore"
import { resolveGenderedTemplates, type Gender, type PromptTemplate } from "src/lib/promptTemplates"

const props = withDefaults(
  defineProps<{
    gender: Gender | null
    selected: string[]
    maxSelected?: number
    requiredCount?: number
    minRequired?: number
    selectable?: boolean
    showConfirm?: boolean
    confirmLabel?: string
    stickyConfirm?: boolean
    gridMin?: number
    selectionMode?: "single" | "multi"
  }>(),
  {
    maxSelected: 3,
    selectable: true,
    showConfirm: true,
    confirmLabel: "Confirm Choices",
    stickyConfirm: true,
    gridMin: 120,
    selectionMode: "multi",
  },
)

const emit = defineEmits<{
  (e: "update:selected", value: string[]): void
  (e: "confirm"): void
}>()

const tplStore = usePromptTemplatesStore()

onMounted(() => {
  if (!tplStore.loaded && !tplStore.loading) {
    void tplStore.loadSubjectFaceTemplates()
  }
})

const displayTemplates = computed<PromptTemplate[]>(() => {
  if (!props.gender) return []
  return resolveGenderedTemplates(tplStore.templates, props.gender)
})

const $q = useQuasar()
const gridStyle = computed(() => {
  // On small screens, force two columns for better scanability
  if ($q.screen.lt.sm) {
    return {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "8px",
    }
  }
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${props.gridMin}px, 1fr))`,
    gap: "10px",
  }
})

const confirmBarStyle = computed<CSSProperties>(() => (props.stickyConfirm ? { position: "sticky", bottom: "20px" } : {}))

const requiredCountComputed = computed(() => props.requiredCount ?? props.maxSelected)
const selectedSet = computed(() => new Set(props.selected))
const confirmDisabled = computed(() => {
  if (!props.selectable) return true
  const n = props.selected.length
  if (props.requiredCount !== undefined && props.requiredCount !== null) return n !== props.requiredCount
  if (props.minRequired !== undefined && props.minRequired !== null) return n < props.minRequired
  return n === 0
})

function onTileClick(id: string) {
  if (!props.selectable) return
  const arr = [...props.selected]
  const idx = arr.indexOf(id)
  if (props.selectionMode === "single") {
    if (idx >= 0 && arr.length === 1) {
      emit("update:selected", [])
    } else {
      emit("update:selected", [id])
    }
    return
  }
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    if (arr.length >= props.maxSelected) return
    arr.push(id)
  }
  emit("update:selected", arr)
}

// Reset/trim selection when template list or constraints change
watch([() => props.gender, () => tplStore.templates, () => props.maxSelected, () => props.selectionMode], () => {
  const valid = new Set(displayTemplates.value.map((t) => t.id))
  let next = props.selected.filter((id) => valid.has(id))
  if (props.selectionMode === "single" && next.length > 1) next = next.slice(0, 1)
  if (props.selectionMode === "multi" && next.length > props.maxSelected) next = next.slice(0, props.maxSelected)
  if (next.length !== props.selected.length) emit("update:selected", next)
})
</script>

<style scoped>
.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

/* Ensure at least 2 items per row on small phones */
@media (max-width: 430px) {
  .template-grid {
    /* Override inline gridTemplateColumns coming from :style */
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
  }
}
</style>
