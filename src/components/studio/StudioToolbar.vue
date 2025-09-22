<template lang="pug">
q-toolbar.bg-grey-9.text-white.studio-toolbar
  .row.items-center.full-width
    q-btn(flat dense round icon="menu" class="q-mr-sm" @click="$emit('toggle-assets')")
      q-tooltip(anchor="bottom middle" self="top middle") Toggle assets
    q-btn(flat dense round icon="undo" :disable="!canUndo" @click="$emit('undo')")
      q-tooltip(anchor="bottom middle" self="top middle") Undo
    q-btn(flat dense round icon="redo" :disable="!canRedo" @click="$emit('redo')" class="q-mr-md")
      q-tooltip(anchor="bottom middle" self="top middle") Redo
    q-select(
      dense
      outlined
      dark
      :options="aspectOptions"
      emit-value
      map-options
      :model-value="aspectPreset"
      class="q-mr-md"
      options-dense
      style="min-width:130px;"
      @update:model-value="$emit('update:aspectPreset', $event)"
    )
    .row.items-center.q-gutter-xs
      q-btn(flat dense round icon="zoom_out" @click="$emit('zoom-out')")
      div.text-caption {{ Math.round(zoom * 100) }}%
      q-btn(flat dense round icon="zoom_in" @click="$emit('zoom-in')")
    q-space
    q-toggle(dense label="Grid" color="primary" :model-value="showGrid" @update:model-value="$emit('update:showGrid', $event)" class="q-mr-md")
    q-btn(round dense color="primary" icon="auto_fix_high" :loading="isProcessing" @click="$emit('rebuild')" class="q-mr-sm")
      q-tooltip(anchor="bottom middle" self="top middle") Harmonize with Kontext
    q-btn(unelevated color="accent" label="Save / Export" @click="$emit('export')")
</template>

<script lang="ts">
import { computed, defineComponent } from "vue"
import type { StudioAspectPreset } from "src/stores/studioStore"

export default defineComponent({
  name: "StudioToolbar",
  props: {
    zoom: {
      type: Number,
      default: 1,
    },
    showGrid: {
      type: Boolean,
      default: true,
    },
    aspectPreset: {
      type: String as () => StudioAspectPreset,
      default: "1:1",
    },
    canUndo: {
      type: Boolean,
      default: false,
    },
    canRedo: {
      type: Boolean,
      default: false,
    },
    isProcessing: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    "toggle-assets",
    "undo",
    "redo",
    "zoom-in",
    "zoom-out",
    "update:aspectPreset",
    "update:showGrid",
    "rebuild",
    "export",
  ],
  setup() {
    const aspectOptions = computed(() => [
      { label: "Square 1:1", value: "1:1" },
      { label: "Portrait 3:4", value: "3:4" },
      { label: "Portrait 9:16", value: "9:16" },
      { label: "Landscape 4:3", value: "4:3" },
      { label: "Landscape 16:9", value: "16:9" },
    ])

    return { aspectOptions }
  },
})
</script>

<style scoped>
.studio-toolbar {
  border-radius: 12px;
  padding: 0 12px;
}

.studio-toolbar :deep(.row) {
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 768px) {
  .studio-toolbar {
    padding: 8px;
  }
}
</style>
