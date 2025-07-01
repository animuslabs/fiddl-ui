<template>
  <div class="q-pa-md">
    <div class="q-mb-md">
      <h3>Select Training Preset</h3>
      <q-select v-model="selectedPreset" :options="presetOptions" option-label="name" option-value="name" label="Training Preset" emit-value map-options outlined dense />
    </div>

    <div class="q-mb-md">
      <h3>Select Training Model</h3>
      <PickModel @select-model="onSelectModel" />
      <div v-if="selectedModel" class="q-mt-sm text-primary">Selected Model: {{ selectedModel.name }}</div>
    </div>

    <div class="q-mb-md">
      <h3>Select Training Set</h3>
      <PickTrainingSet @select-set="onSelectSet" />
      <div v-if="selectedSet" class="q-mt-sm text-primary">Selected Set: {{ selectedSet.name }}</div>
    </div>

    <q-btn label="Create Model" color="primary" :disable="!canCreate" class="q-mt-lg" size="lg" icon="add" rounded @click="emitCreate" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { faceForgePresets } from "lib/faceForgePresets"
import PickModel from "./PickModel.vue"
import PickTrainingSet from "./PickTrainingSet.vue"
import type { CustomModel, TrainingSet } from "lib/api"

const selectedPreset = ref<string | null>(null)
const selectedModel = ref<CustomModel | null>(null)
const selectedSet = ref<TrainingSet | null>(null)

const presetOptions = faceForgePresets

const canCreate = computed(() => selectedPreset.value && selectedModel.value && selectedSet.value)

function onSelectModel(model: CustomModel) {
  selectedModel.value = model
}
function onSelectSet(set: TrainingSet) {
  selectedSet.value = set
}

function emitCreate() {
  if (canCreate.value) {
    emit("create", {
      preset: faceForgePresets.find((p) => p.name === selectedPreset.value)!,
      model: selectedModel.value!,
      set: selectedSet.value!,
    })
  }
}

// define emits for <script setup>
const emit = defineEmits<{
  (
    e: "create",
    payload: {
      preset: (typeof faceForgePresets)[number]
      model: CustomModel
      set: TrainingSet
    },
  ): void
}>()
</script>
