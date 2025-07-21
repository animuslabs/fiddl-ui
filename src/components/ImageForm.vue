<template lang="pug">
  q-form.create-form.col.fit(@submit.prevent="createImage")
    component(:is="scrollWrapperComponent" :class="{'form-scroll':quasar.screen.lt.md}")
      .centered.q-pa-md.relative-position
        q-input(
          v-model="req.prompt"
          style="resize:none;"
          :disable="createStore.anyLoading"
          @keydown.enter.prevent="createImage"
          color="primary"
          filled
          type="textarea"
          placeholder="Enter a description of the image to create"
          :autogrow="quasar.screen.lt.md"
        ).full-width
        .absolute-bottom-right(style="margin-bottom:30px; margin-right:30px;")
          q-btn(icon="clear" flat @click="req.prompt = ''" :disable="createStore.anyLoading" round)
          q-tooltip Clear Prompt

      .centered.q-ma-md
        q-btn(icon="lightbulb" flat @click="createStore.newPrompt()" :loading="loading.new" :disable="createStore.anyLoading").q-mr-md
          .badge-sm {{ prices.promptTools.randomPrompt }}
          q-tooltip
            p Generate a new prompt
        q-btn(icon="shuffle" flat @click="createStore.randomizePrompt()" :loading="loading.randomize" :disable="createStore.anyLoading || req.prompt?.length < 10").q-mr-md
          .badge-sm {{ prices.promptTools.randomPrompt }}
          q-tooltip
            p Randomize an element of the prompt
        q-btn(icon="arrow_upward" flat @click="createStore.improvePrompt()" :loading="loading.improve" :disable="createStore.anyLoading || req.prompt?.length < 10")
          .badge-sm {{ prices.promptTools.improvePrompt }}
          q-tooltip
            p Improve the prompt

      q-separator(color="grey-9" spaced="20px" inset)
      .centered.q-gutter-md
        div
          p Quantity
          .row
            q-input(v-model.number="req.quantity" type="number" :min="1" :max="100" style="width:45px; max-width:20vw;" no-error-icon :disable="createStore.anyLoading || req.seed != undefined")
            q-tooltip(v-if="req.seed != undefined") Can't adjust quantity when using custom seed
            .column
              q-btn(size="sm" icon="add" flat round @click="req.quantity++" :disable="req.quantity >= 100 || req.seed != undefined")
              q-btn(size="sm" icon="remove" flat round @click="req.quantity--" :disable="req.quantity <= 1 || req.seed != undefined")
        div
          p Aspect Ratio
          .row
            q-select(v-model="req.aspectRatio" :options="createStore.availableAspectRatios" style="font-size:20px;" :disable="createStore.anyLoading")
        div.q-ma-md(v-if="req.seed != undefined")
          p Seed
          .row(style="max-width:150px;").no-wrap
            q-input(v-model.number="req.seed" type="number" placeholder="Random" clearable :disable="createStore.anyLoading")
            .column
              q-btn(size="sm" icon="add" flat round @click="req.seed++" :disable="!req.seed")
              q-btn(size="sm" icon="remove" flat round @click="req.seed--" :disable="!req.seed")

      .row
        div.q-ma-md.relative-position
          p Model:
          .row.items-center.relative-position
            .badge-sm {{ createStore.selectedModelPrice }}
            q-select(v-model="req.model" :options="createStore.availableModels" style="font-size:20px;" :disable="createStore.anyLoading")
            div.q-ml-md(v-if="req.model === 'custom'")
              .row.q-gutter-md
                h4 {{ req.customModelName }}
                q-btn(round flat icon="list" @click="showModelPicker = true")
    .full-width(style="height:30px;").gt-sm
    .centered.relative-position.q-pb-md.q-pt-md.bg-grey-10(v-if="$userAuth.userData" style="height:50px;")
      div(style="position:absolute; left:15px; top:0px;")
        q-btn(label="< Back" color="accent" outline @click="$emit('back')" v-if="showBackBtn")
      div(style="position:absolute; top:0px; height:50px;" )
        q-btn(type="submit" label="Create" color="primary" :loading="loading.create" :disable="createStore.anyLoading || createStore.totalCost > ($userAuth.userData?.availablePoints || 0) || req.prompt.length < 5")
          .badge {{ createStore.totalCost }}
      div(style="position:absolute; right:15px; top:0px;")
        q-toggle(size="sm" v-model="req.public" color="primary" :disable="createStore.anyLoading" :label="req.public ? 'Public' : 'Private'")

  q-dialog(v-model="showModelPicker")
    q-card
      .q-ma-md
        .row
          h5.q-mb-sm Select a custom model
          .col-grow
          q-btn(icon="add" label="create new model" flat color="primary" @click="$router.push({name:'forge', params:{mode:'create'}})")
        q-separator(color="primary").q-mb-lg
        CustomModelsList(@modelClicked="setCustomModel" trainedOnly)
  </template>

<script lang="ts" setup>
import { ref, computed } from "vue"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import CustomModelsList from "./CustomModelsList.vue"
import { type CustomModel } from "lib/api"
import { useQuasar } from "quasar"
import { prices } from "stores/pricesStore"
const emit = defineEmits(["created", "back"])
const props = defineProps<{ showBackBtn?: boolean }>()
const quasar = useQuasar()

const createStore = useCreateImageStore()
const creationsStore = useImageCreations()

const req = createStore.state.req
const loading = createStore.state.loading

const showModelPicker = ref(false)

function createImage() {
  void createStore.createImage().then(() => emit("created"))
}
const scrollWrapperComponent = computed(() => (quasar.screen.lt.md ? "q-scroll-area" : "div"))
function setCustomModel(model: CustomModel) {
  showModelPicker.value = false
  req.customModelId = model.id
  req.customModelName = model.name
  createStore.state.customModel = model
  void creationsStore.setCustomModelId(model.id)
  creationsStore.filter.model = "custom"
  creationsStore.filter.customModelId = model.id
}
</script>

<style scoped>
textarea::-webkit-resizer {
  display: none;
}

.create-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}

.form-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  height: 700px;
}
@media (max-width: 1000px) {
  .form-scroll {
    height: calc(100vh - 150px);
    overflow: hidden;
  }
}
</style>
