<template lang="pug">
  div
    .centered.q-mb-md
      h3 Train a Custom Model
    .row.q-col-gutter-sm.full-width
      .col-12.col-md-6
        h6 Training Set
        .centered
          TrainingSetCard.q-mb-md(
            v-if="state.trainingSet"
            :trainingSet="state.trainingSet"
            @updated="reloadSelectedSet"
            hide-buttons
          )
        .centered.q-ma-md(v-if="!state.trainingSet")
          h5.text-secondary No Training Set Selected
        .centered
          q-btn(size="md" label="Select a Training Set" outline color="primary" rounded @click="state.dialogOpen = true")

      .col-12.col-md-6.q-mb-md
        .centered.q-gutter-sm.q-mb-md
          .col
            p.q-mt-md Base Model
            q-btn.q-mt-md(rounded :label="state.baseModel.name" color="primary" outline size="lg" no-caps)
              .badge
                p {{ prices.forge.trainBaseModel[state.baseModel.value] }}
              q-menu
                q-list(padding style="max-width:300px")
                  .q-ma-lg.cursor-pointer.relative-position(
                    v-for="model in baseModels"
                    :key="model.name"
                    clickable
                    v-close-popup
                    @click="state.baseModel = model"
                  )
                    .absolute(style="left:-15px; height:100%; width:5px;" v-if="model.name == state.baseModel.name").bg-primary
                    .row
                      h4.relative-position.q-pr-lg {{ model.name }}
                        .badge(style="")
                          p {{ prices.forge.trainBaseModel[model.value] }}
                    .row
                      p {{ model.description }}
          .col
            p.q-mt-md Training Mode
            q-btn.q-mt-md.text-capitalize(rounded :label="state.modelMode.value" color="primary" outline size="lg" no-caps :icon="state.modelMode.icon")
              q-menu(style="text-transform: none;")
                q-list(padding style="max-width:300px" separator)
                  .q-ma-lg.cursor-pointer.relative-position(
                    v-for="mode in trainingModes"
                    :key="mode.value"
                    clickable
                    v-close-popup
                    @click="state.modelMode = mode"
                  )
                    .absolute(style="left:-15px; height:100%; width:5px;" v-if="mode.value === state.modelMode.value").bg-primary
                    .row.align-items
                      q-icon.q-mr-sm(:name="mode.icon" size="36px")
                      h4.relative-position.q-pr-lg.text-capitalize {{ mode.value }}
                    .row.q-mt-xs
                      p {{ mode.description }}

          .col
            p.q-mt-md Model Type
            q-btn.q-mt-md.relative-position(rounded :label="state.fineTuneType.label" color="primary" outline size="lg" no-caps)
              .badge
                p {{ prices.forge.fineTuneType[state.fineTuneType.value] }}
              q-menu
                q-list(padding style="max-width:300px")
                  .q-ma-lg.cursor-pointer.relative-position(
                    v-for="type in fineTuneTypeData"
                    :key="type.value"
                    clickable
                    v-close-popup
                    @click="state.fineTuneType = type"
                    :class="{'disabled':state.baseModel.value == 'fluxDev' && type.value == 'full'}"
                  )
                    .absolute(style="left:-15px; height:100%; width:5px;" v-if="type.value === state.fineTuneType.value").bg-primary
                    .row
                      h4.relative-position.q-pr-lg {{ type.label }}
                        .badge
                          p {{ prices.forge.fineTuneType[type.value] }}
                    .row
                      p {{ type.description }}

        p Model Name
        q-input.q-mb-md.q-mt-sm(v-model="state.name" input-style="font-size:24px" style="font-size:40px" filled)
        p Model Description
        q-input.q-mt-sm(v-model="state.description" type="textarea" filled autogrow)
        .centered.q-mt-md.relative-position
        .centered
          q-btn.q-mt-lg(
            label="Start Training"
            color="primary"
            size="lg"
            icon="model_training"
            :disable="!canCreate"
            @click="state.showConfirmWindow = true"
          )
            .badge-lg
              p {{ totalCost }}

    q-dialog(v-model="state.dialogOpen")
      PickTrainingSet(@select-set="onSelectSet" @create-set="router.push({name:'forge',params:{mode:'createSet'}})")
    q-dialog(v-model="state.showConfirmWindow"  )
      q-card.q-pa-md(style="min-height:300px; width:500px; max-width:100vw;")
        h3.text-secondary Confirm
        p You are about to create a custom model.
        p The process will take 15-45 minutes depending on the number of images and model settings.
        .centered.q-gutter-md.items-center.q-mt-md
          q-img.q-ml-sm(src="/FiddlPointsLogo-sm.svg" style="width:60px;" alt="fiddl points logo" no-spinner)
        .centered.q-mt-sm
          h4 The cost is #[strong {{ totalCost }} Fiddl Points]
        .centered.q-ma-md.q-mt-xl.items-center.q-gutter-md
          div.relative-position
            q-btn( label="Start Training" color="primary" size="lg" icon="model_training" :disable="!canCreate" @click="createModel")
              .badge-lg
                p {{ totalCost }}
        .centered
          q-btn( label="< back" flat color="grey" @click="state.showConfirmWindow = false")
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watchEffect, readonly } from "vue"
import PickTrainingSet from "./PickTrainingSet.vue"
import TrainingSetCard from "./TrainingSetCard.vue"
import type { TrainingSet } from "lib/api"
import { modelsCreateModel, trainingSetsGetSet } from "lib/orval"
import { useRoute, useRouter } from "vue-router"
import { trainModelPrice, catchErr } from "lib/util"
import { baseModels, fineTuneTypeData, trainingModes } from "lib/createModelConfigs"
import { Loading } from "quasar"
import { prices } from "src/stores/pricesStore"
import { events } from "lib/eventsManager"

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const querySet = route.query.trainingSetId
  if (typeof querySet != "string") return
  void reloadSelectedSet(querySet)
})

function onSelectSet(set: TrainingSet) {
  state.trainingSet = set
  state.dialogOpen = false
  void router.replace({ query: { ...route.query, trainingSetId: set.id } })
}

async function reloadSelectedSet(trainingSetId?: string) {
  try {
    if (!state.trainingSet && !trainingSetId) return
    const setResult = await trainingSetsGetSet({ trainingSetId: trainingSetId || state.trainingSet?.id || "" })
    state.trainingSet = setResult.data
    void router.replace({ query: { ...route.query, trainingSetId: trainingSetId || state.trainingSet?.id } })
  } catch (err: any) {
    console.error(err)
    state.trainingSet = null
  }
}

const canCreate = computed(() => !!state.trainingSet && !!state.name?.trim())

const totalCost = computed(() => trainModelPrice(state.baseModel.value, state.fineTuneType.value))

async function startTraining() {
  if (!state.baseModel || !state.fineTuneType || !state.modelMode || !state.name || !state.trainingSet) return
  console.log("start training")
  try {
    const { data } = await modelsCreateModel({
      baseModel: state.baseModel.value,
      description: state.description || "",
      fineTuneType: state.fineTuneType.value,
      modelMode: state.modelMode.value,
      name: state.name,
      trainingSetId: state.trainingSet.id,
    })
    console.log(data)
    try {
      events.customModelCreated({
        customModelId: String(data),
        trainingSetId: state.trainingSet.id,
        baseModel: state.baseModel.value,
        fineTuneType: state.fineTuneType.value,
        modelMode: state.modelMode.value,
        name: state.name || undefined,
      })
    } catch {}
    void router.push({ name: "forge", params: { mode: "train" }, query: { customModelId: data } })
  } catch (err: any) {
    catchErr(err)
  } finally {
    Loading.hide()
  }
}

function createModel() {
  if (!canCreate.value) return
  // state.showConfirmWindow = false
  Loading.show()
  void startTraining()
}

const state = reactive({
  modelMode: Object.freeze(trainingModes[0]!),
  baseModel: Object.freeze(baseModels[0]!),
  fineTuneType: Object.freeze(fineTuneTypeData[0]!),
  name: null as string | null,
  description: null as string | null,
  dialogOpen: false as boolean,
  trainingSet: null as TrainingSet | null,
  showConfirmWindow: false,
})

watchEffect(() => {
  if (!state.trainingSet) return
  if (state.trainingSet.numImages < 30 && state.fineTuneType.value === "full") {
    state.fineTuneType = fineTuneTypeData[0]!
    catchErr("Advanced mode requires at least 30 training images.")
  }
})
</script>
