<template lang="pug">
q-card(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0; overflow:auto;' : 'width:820px; max-width:95vw; max-height:85vh; overflow:auto;'")
  // Header
  q-card-section.z-top.bg-grey-10(style="position:sticky; top:0; z-index:10;")
    .row.items-center.justify-between
      h6.q-mt-none.q-mb-none Select Model
      q-btn(flat dense round icon="close" @click="emit('close')")
    q-separator
  // Content
  q-card-section
    div(v-if="loading")
      .centered.q-pa-md
        q-spinner-dots(color="primary" size="24px")
    .model-grid(v-else)
      SimpleModelCard(
        v-for="m in displayModels"
        :key="m.slug"
        :model="m"
        :selected="currentSlug === m.slug"
        :price="priceOfSlug(m.slug)"
        @click="selectAndClose(m.slug)"
      )

  q-separator
  // Actions
  q-card-actions.z-top.bg-grey-10(align="right" style="position:sticky; bottom:0; z-index:10;")
    q-btn(flat color="secondary" label="Cancel" @click="emit('close')")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import * as modelsStore from 'src/stores/modelsStore'
import { useCreateImageStore } from 'src/stores/createImageStore'
import SimpleModelCard from 'src/components/SimpleModelCard.vue'
import type { ImageModel } from 'src/lib/imageModels'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', model: ImageModel): void
}>()

const $q = useQuasar()
const createStore = useCreateImageStore()
const currentSlug = computed(() => createStore.state.req.model)
const loading = ref(false)

const displayModels = computed(() => {
  const base = modelsStore.models.base || []
  const allowed = new Set<string>([...createStore.availableModels].filter((m) => m !== 'custom'))
  return base.filter((m) => allowed.has(m.slug))
})

function priceOfSlug(slug: string): number {
  return createStore.priceForModel(slug as ImageModel)
}

function selectAndClose(slug: string) {
  emit('select', slug as ImageModel)
}

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
})
</script>

<style scoped>
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}
</style>
