<template lang="pug">
  .q-pa-md.q-px-lg
    .centered.q-mb-md
      h3 Train Custom Model
    .row.q-col-gutter-lg.full-width
      .col-12.col-md-6
        h6 Training Set
        .centered
          TrainingSetCard.q-mb-md(
            v-if="selectedSet"
            :trainingSet="selectedSet"
            @updated="reloadSelectedSet"
          )
        .centered.q-ma-md(v-if="!selectedSet")
          h5.text-secondary No Set Selected
        .centered
          q-btn(label="Choose Training Set" outline color="primary" rounded @click="dialogOpen = true")

        .row.q-gutter-md.q-mt-md
          .col
            p.q-mt-md Base Model
            q-btn.q-mt-md(:label="selectedBaseModel.name" color="primary" outline size="md" no-caps)
              .badge-lg
                p {{ selectedBaseModel.price }}
              q-menu
                q-list(padding style="max-width:200px")
                  .q-ma-lg.cursor-pointer.relative-position(
                    v-for="model in baseModels"
                    :key="model.name"
                    clickable
                    v-close-popup
                    @click="selectedBaseModel = model"
                  )
                    .absolute(style="left:-15px; height:100%; width:5px;" v-if="model.name == selectedBaseModel.name").bg-primary
                    .row
                      h5.relative-position.q-pr-md {{ model.name }}
                        .badge-lg
                          p {{ model.price }}
                    .row
                      p {{ model.description }}
          .col
            p.q-mt-md Training Preset
            q-btn.q-mt-md(:label="selectedPreset.name" color="primary" outline size="md" no-caps)
              .badge-lg
                p {{ selectedPreset.price }}
              q-menu
                q-list(padding style="max-width:200px")
                  .q-ma-lg.cursor-pointer.relative-position(
                    v-for="preset in trainingPresets"
                    :key="preset.name"
                    clickable
                    v-close-popup
                    @click="selectedPreset = preset"
                  )
                    .absolute(style="left:-15px; height:100%; width:5px;" v-if="preset.name === selectedPreset.name").bg-primary
                    .row
                      h5.relative-position.q-pr-lg {{ preset.name }}
                        .badge-lg
                          p {{ preset.price }}
                    .row
                      p {{ preset.description }}

        .q-mt-md(v-if="isCustom")
          p Custom Parameters
          .q-pa-sm
            q-slider(v-model="advanced.steps" :min="100" :max="2000" :step="100" label-always dense)
            q-input(v-model.number="advanced.learningRate" label="Learning Rate" type="number" dense outlined)

      .col-12.col-md-6
        p Model Name
        q-input.q-mb-md.q-mt-sm(v-model="modelName" input-style="font-size:24px" style="font-size:40px" filled)
        p Model Description
        q-input.q-mt-sm(v-model="modelDescription" type="textarea" filled autogrow )
        .centered.q-mt-md.relative-position
        .centered
          q-btn.q-mt-lg(
            label="Create Model"
            color="primary"
            size="lg"
            icon="add"
            :disable="!canCreate"
            @click="createModel"
          )
            .badge-lg
              p {{ totalCost }}

    q-dialog(v-model="dialogOpen")
      PickTrainingSet(@select-set="onSelectSet")
  </template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue"
import PickTrainingSet from "./PickTrainingSet.vue"
import TrainingSetCard from "./TrainingSetCard.vue"
import type { TrainingSet } from "lib/api"

interface BaseModelData {
  name: "Flux Dev" | "Flux Pro" | "Flux Pro Ultra"
  description: string
  price: number
}
const baseModels: BaseModelData[] = [
  { name: "Flux Dev", description: "For quick experiments", price: 400 },
  { name: "Flux Pro", description: "Realistic", price: 800 },
  { name: "Flux Pro Ultra", description: "Insanely detailed", price: 1200 },
]

interface TrainingPresetData {
  name: "Basic" | "Advanced" | "Custom"
  description: string
  price: number
}
const trainingPresets: TrainingPresetData[] = [
  { name: "Basic", description: "Default settings", price: 200 },
  { name: "Advanced", description: "Better quality", price: 500 },
  { name: "Custom", description: "Fine-tune parameters", price: 0 },
]

const dialogOpen = ref(false)
const selectedSet = ref<TrainingSet | null>(null)
function onSelectSet(set: TrainingSet) {
  selectedSet.value = set
  dialogOpen.value = false
}
function reloadSelectedSet() {}

const selectedBaseModel = ref<BaseModelData>(baseModels[0]!)
const selectedPreset = ref<TrainingPresetData>(trainingPresets[0]!)
const isCustom = computed(() => selectedPreset.value.name === "Custom")

const modelName = ref("")
const modelDescription = ref("")
const advanced = reactive({ steps: 800, learningRate: 0.0001 })

const canCreate = computed(() => !!selectedSet.value && !!selectedBaseModel.value && !!selectedPreset.value && !!modelName.value.trim())

const totalCost = computed(() => selectedBaseModel.value.price + selectedPreset.value.price)

function startTraining() {
  // TODO: implement API call
  console.log("Starting training with:", {
    set: selectedSet.value,
    baseModel: selectedBaseModel.value,
    preset: selectedPreset.value,
    name: modelName.value.trim(),
    description: modelDescription.value.trim(),
    params: { ...advanced },
    cost: totalCost.value,
  })
}

function createModel() {
  if (!canCreate.value) return
  startTraining()
}
</script>
