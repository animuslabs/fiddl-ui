<template lang="pug">
div.studio-output-drawer(:class="{ open }")
  header.row.items-center.justify-between.q-px-md
    .text-subtitle2 Recent Outputs
    q-btn(flat dense round :icon="open ? 'expand_more' : 'expand_less'" @click="$emit('toggle')")
  q-separator(dark inset)
  div.studio-output-drawer__content
    template(v-if="outputs.length")
      q-card(v-for="output in outputs" :key="output.id" flat bordered dark class="studio-output-drawer__item")
        q-img(:src="output.src" no-spinner :ratio="1" :alt="'output ' + output.id")
        q-card-actions(align="between")
          q-btn(flat dense label="Add" @click="$emit('add-to-canvas', output)")
          q-btn(flat dense icon="download" @click="$emit('download', output)")
          q-btn(flat dense color="negative" icon="delete" @click="$emit('discard', output)")
    template(v-else)
      .text-caption.text-grey-6.q-pa-md Harmonized images will show up here
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import type { StudioOutputEntry } from "src/stores/studioStore"

export default defineComponent({
  name: "StudioOutputDrawer",
  props: {
    outputs: {
      type: Array as PropType<StudioOutputEntry[]>,
      default: () => [],
    },
    open: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["toggle", "add-to-canvas", "download", "discard"],
})
</script>

<style scoped>
.studio-output-drawer {
  background: rgba(18, 18, 18, 0.95);
  color: white;
  border-radius: 16px 16px 0 0;
  padding-top: 8px;
  transition: transform 0.2s ease;
  transform: translateY(calc(100% - 56px));
}

.studio-output-drawer.open {
  transform: translateY(0);
}

.studio-output-drawer__content {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 12px 16px 20px;
}

.studio-output-drawer__item {
  width: 160px;
  min-width: 160px;
}
</style>
