<template lang="pug">
div.studio-inspector
  .text-caption.text-grey-5.q-mb-sm Quick Filters
  .row.q-gutter-xs.q-mb-sm
    q-chip(
      v-for="option in filterOptions"
      :key="option.value ?? 'none'"
      clickable
      size="sm"
      :outline="item.edits.filter !== option.value"
      :color="item.edits.filter === option.value ? 'primary' : 'grey-8'"
      text-color="white"
      @click="() => updateFilter(option.value)"
    ) {{ option.label }}
  q-separator(dark inset class="q-my-sm")
  .text-caption.text-grey-5.q-mb-sm Adjustments
  .row.items-center.justify-between.text-caption
    span Brightness
    span {{ item.edits.brightness }}
  q-slider(
    dense
    :min="-100"
    :max="100"
    :step="1"
    color="primary"
    :model-value="item.edits.brightness"
    @update:model-value="(val) => updateBrightness(val, false)"
    @change="(val) => updateBrightness(val, true)"
  )
  .row.items-center.justify-between.text-caption.q-mt-md
    span Contrast
    span {{ item.edits.contrast }}
  q-slider(
    dense
    :min="-100"
    :max="100"
    :step="1"
    color="primary"
    :model-value="item.edits.contrast"
    @update:model-value="(val) => updateContrast(val, false)"
    @change="(val) => updateContrast(val, true)"
  )
  q-separator(dark inset class="q-my-sm")
  .text-caption.text-grey-5.q-mb-xs Describe Edit
  q-input(
    filled
    dense
    type="textarea"
    :rows="3"
    placeholder="Add or remove elements, describe lighting, etc."
    :model-value="promptDraft"
    @update:model-value="updatePrompt"
    @blur="() => commitPrompt()"
  )
  q-btn(
    class="q-mt-sm full-width"
    unelevated
    color="accent"
    icon="auto_fix_high"
    :disable="!canRequest || loading"
    :loading="loading"
    label="Send Edit Request"
    @click="emitRequest"
  )
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, watch } from "vue"
import type { StudioItem } from "src/stores/studioStore"

interface FilterOption {
  label: string
  value: string | null
}

export default defineComponent({
  name: "StudioInspector",
  props: {
    item: {
      type: Object as PropType<StudioItem>,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update-edits", "request-edit"],
  setup(props, { emit }) {
    const promptDraft = ref(props.item.edits.prompt)

    watch(
      () => props.item.id,
      () => {
        promptDraft.value = props.item.edits.prompt
      },
      { immediate: true },
    )

    const filterOptions: FilterOption[] = [
      { label: "None", value: null },
      { label: "Soft Light", value: "soft" },
      { label: "Vivid", value: "vivid" },
      { label: "B&W", value: "bw" },
    ]

    const canRequest = computed(() => {
      return props.item.edits.filter !== null || promptDraft.value.trim().length > 0
    })

    function updateFilter(value: string | null) {
      emit("update-edits", { updates: { filter: value }, commit: true })
    }

    function clampValue(value: number | null) {
      const v = value ?? 0
      return Math.max(-100, Math.min(100, v))
    }

    function updateBrightness(value: number | null, commit: boolean) {
      emit("update-edits", {
        updates: { brightness: clampValue(value) },
        commit,
      })
    }

    function updateContrast(value: number | null, commit: boolean) {
      emit("update-edits", {
        updates: { contrast: clampValue(value) },
        commit,
      })
    }

    function updatePrompt(value: string | number | null) {
      const v = typeof value === "string" ? value : String(value ?? "")
      promptDraft.value = v
      emit("update-edits", { updates: { prompt: v }, commit: false })
    }

    function commitPrompt() {
      emit("update-edits", { updates: { prompt: promptDraft.value }, commit: true })
    }

    function emitRequest() {
      if (!canRequest.value || props.loading) return
      commitPrompt()
      emit("request-edit")
    }

    return {
      promptDraft,
      filterOptions,
      canRequest,
      updateFilter,
      updateBrightness,
      updateContrast,
      updatePrompt,
      commitPrompt,
      emitRequest,
    }
  },
})
</script>

<style scoped>
.studio-inspector {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.studio-inspector :deep(.q-chip) {
  background: rgba(255, 255, 255, 0.12);
}
</style>
