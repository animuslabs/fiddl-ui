<template lang="pug">
.simple-model-card(:class="{ selected }" @click.stop="$emit('click', model)")
  .row.no-wrap.items-start
    // Optional checkbox area for multi-select parents
    q-checkbox.q-mr-sm(v-if="showCheckbox" :model-value="checked" @update:model-value="$emit('update:checked', $event)" color="primary" @click.stop)
    .col
      .row.items-center.no-wrap
        h6.q-mt-none.q-mb-none.text-bold {{ model.name }}
        q-chip.q-ml-sm(v-if="price != null" dense color="grey-9" text-color="white") {{ price }}
        q-space
        q-btn(flat dense round icon="open_in_new" @click.stop="toModelPage()")
          q-tooltip Open model page
      .text-caption.text-grey-5 {{ shortDesc(model.description) }}
      .row.q-gutter-xs.q-mt-xs
        q-chip(v-for="t in (model.modelTags||[])" :key="t" dense color="grey-9" text-color="white") {{ t }}
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ModelsGetBaseModels200Item, ModelsGetPublicModels200Item } from 'lib/orval'

type BaseOrCustom = Partial<ModelsGetPublicModels200Item> & Partial<ModelsGetBaseModels200Item> & {
  slug: string
  name: string
  description?: string | null
  modelTags?: string[]
  id?: string
}

const props = defineProps({
  model: { type: Object as () => BaseOrCustom, required: true },
  selected: { type: Boolean, default: false },
  price: { type: Number as () => number | null, default: null },
  showCheckbox: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
})

defineEmits(['click', 'update:checked'])

const router = useRouter()

function shortDesc(text?: string | null): string {
  if (!text) return ''
  const t = String(text)
  return t.length > 120 ? t.slice(0, 117) + '…' : t
}

function toModelPage() {
  if (props.model.id) {
    void router.push({ name: 'model', params: { modelName: 'custom', customModelId: props.model.id } })
  } else {
    void router.push({ name: 'model', params: { modelName: props.model.slug } })
  }
}
</script>

<style scoped>
.simple-model-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}
.simple-model-card.selected {
  border-color: var(--q-primary);
  background: rgba(255, 255, 255, 0.04);
}
</style>

