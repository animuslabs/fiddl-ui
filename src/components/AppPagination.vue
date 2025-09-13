<template lang="pug">
div.app-pagination
  // Desktop / tablet: full pagination control, compact, single row, horizontal scroll if needed
  .gt-xs.scroll-x.nowrap-flex
    q-pagination(
      v-model="innerPage"
      :max="max"
      :max-pages="maxPages"
      :boundary-links="boundaryLinks"
      :direction-links="directionLinks"
      :color="color"
      :size="size"
      :disable="disable"
      :ellipses="ellipses"
      :boundary-numbers="boundaryNumbers"
      @update:model-value="onPageUpdate"
    )

  // Mobile: prev / page / next only, single row, primary text
  .row.justify-center.items-center.lt-sm.q-gutter-xs.nowrap-flex.scroll-x
    q-btn(round dense flat icon="chevron_left" color="primary" :disable="disable || innerPage <= 1" @click="prev")
    q-chip(flat size="sm" text-color="primary" :label="String(innerPage)")
    q-btn(round dense flat icon="chevron_right" color="primary" :disable="disable || innerPage >= Math.max(1, max)" @click="next")
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  max: number
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  maxPages?: number
  boundaryLinks?: boolean
  directionLinks?: boolean
  ellipses?: boolean
  boundaryNumbers?: boolean
  disable?: boolean
}>(), {
  color: 'primary',
  size: 'sm',
  maxPages: 8,
  boundaryLinks: true,
  directionLinks: true,
  ellipses: true,
  boundaryNumbers: false,
  disable: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const innerPage = computed({
  get: () => props.modelValue || 1,
  set: (v: number) => emit('update:modelValue', v),
})

function onPageUpdate(v: number) {
  emit('update:modelValue', v)
}

function prev() {
  if (props.disable) return
  const p = Math.max(1, (props.modelValue || 1) - 1)
  emit('update:modelValue', p)
}

function next() {
  if (props.disable) return
  const p = Math.min(Math.max(1, props.max), (props.modelValue || 1) + 1)
  emit('update:modelValue', p)
}
</script>

<style scoped>
.app-pagination { max-width: 100%; }
.scroll-x {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.nowrap-flex { display: flex; flex-wrap: nowrap; }
.app-pagination :deep(.q-pagination__content) {
  flex-wrap: nowrap; /* prevent wrapping */
}
.app-pagination :deep(.q-pagination__content .q-btn) {
  /* compact visuals on desktop/tablet */
  --q-btn-padding: 2px 8px;
}
</style>
