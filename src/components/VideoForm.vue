<template lang="pug">
  q-form.create-form.col.fit(@submit.prevent="create" style="padding-bottom: env(safe-area-inset-bottom, 24px);")
    component(:is="scrollWrapperComponent" :class="{'form-scroll':quasar.screen.lt.md}")
      .centered.q-pb-md.relative-position
        q-input.full-width( v-model="vidStore.state.req.prompt" style="resize:none;" :disable="anyLoading" @keydown.enter.prevent="create" color="primary" filled type="textarea" placeholder="Enter a description of the video to create")
        .absolute-bottom-right(style="margin-bottom:30px; margin-right:30px;")
          q-btn(icon="clear" flat @click="vidStore.state.req.prompt = ''" :disable="anyLoading" round)
          q-tooltip Clear Prompt
      .centered.q-ma-md
        q-btn(icon="lightbulb" flat @click="vidStore.newPrompt()" :loading="loading.new" :disable="anyLoading").q-mr-md
          .badge-sm {{ prices.promptTools.randomPrompt }}
          q-tooltip
            p Generate a new prompt
        q-btn(icon="shuffle" flat @click="vidStore.randomizePrompt()" :loading="loading.randomize" :disable="anyLoading || req.prompt?.length < 10").q-mr-md
          .badge-sm {{ prices.promptTools.randomPrompt }}
          q-tooltip
            p Randomize an element of the prompt
        q-btn(icon="arrow_upward" flat @click="vidStore.improvePrompt()" :loading="loading.improve" :disable="anyLoading || req.prompt?.length < 10")
          .badge-sm {{ prices.promptTools.improvePrompt }}
          q-tooltip
            p Improve the prompt

      q-separator(color="grey-9" spaced="20px" inset)
      .centered.q-gutter-md
        div
          p Quantity
          .row
            q-input(v-model.number="req.quantity" type="number" :min="1" :max="3" style="width:45px; max-width:20vw;" no-error-icon :disable="anyLoading || req.seed != undefined")
            q-tooltip(v-if="req.seed != undefined") Can't adjust quantity when using custom seed
            .column
              q-btn(size="sm" icon="add" flat round @click="req.quantity++" :disable="req.quantity >= 3 || req.seed != undefined")
              q-btn(size="sm" icon="remove" flat round @click="req.quantity--" :disable="req.quantity <= 1 || req.seed != undefined")
        div
          p Aspect Ratio
          .row
            q-select(v-model="req.aspectRatio" :options="vidStore.availableAspectRatios" style="font-size:20px;" :disable="anyLoading")
        div
          p Duration
          .row
            q-select(v-model="req.duration" :options="vidStore.availableDurations" style="font-size:20px;" :disable="anyLoading")
        div.q-ma-md(v-if="req.seed != undefined")
          p Seed
          .row(style="max-width:150px;").no-wrap
            q-input(v-model.number="req.seed" type="number" placeholder="Random" clearable :disable="anyLoading")
            .column
              q-btn(size="sm" icon="add" flat round @click="req.seed++" :disable="!req.seed")
              q-btn(size="sm" icon="remove" flat round @click="req.seed--" :disable="!req.seed")

      .row.no-wrap
        div.q-ma-md.relative-position
          p Model
          .row.items-center.relative-position
            .badge-sm {{ vidStore.selectedModelPrice }}
            q-select.text-capitalize(v-model="req.model" :options="videoModels" style="font-size:20px;" :disable="anyLoading")
        div.q-ma-md.relative-position
          p Starting Image
          q-btn.q-mt-sm(label="Choose starting Image" @click="showImageDialog = true")
    .full-width(style="height:30px;").gt-sm
    .centered.relative-position.q-pb-md.q-pt-md.bg-grey-10(v-if="$userAuth.userData" )
      div(style="position:absolute; left:15px; top:0px;")
        q-btn(label="< Back" color="accent" outline @click="$emit('back')" v-if="showBackBtn")
      div(style="position:absolute; top:0px;")
        q-btn(type="submit" label="Create" color="primary" :loading="loading.create" :disable="anyLoading || vidStore.totalCost > ($userAuth.userData?.availablePoints || 0) || req.prompt.length < 5")
          .badge {{ vidStore.totalCost }}
      div(style="position:absolute; right:15px; top:0px;")
        q-toggle(size="sm" v-model="req.public" color="primary" :disable="anyLoading" :label="req.public ? 'Public' : 'Private'")

  q-dialog(v-model="showImageDialog")
    q-card
      .q-ma-md
        .centered
          h4.q-mb-md Create a video from any creation on Fiddl.art
          p This feature is coming soon!
        //-   p When viewing an image, select the video create button to turn the image into a video
        //- .centered.q-mt-md.q-gutter-md
        //-   q-btn(label="< back" outline color="secondary" @click="showImageDialog = false")
        //-   q-btn(label="browse images" color="primary" @click="$router.push({name:'browse'})")
  </template>

<script lang="ts" setup>
import { videoModels } from "lib/imageModels"
import { useQuasar } from "quasar"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { computed, ref, toRef } from "vue"
import { prices } from "stores/pricesStore"
const emit = defineEmits(["created", "back"])
// const props = defineProps({
//   showBackBtn: {
//     type: Boolean,
//     default: false,
//     required: false,
//   },
// })
const quasar = useQuasar()
const showImageDialog = ref(false)

const vidStore = useCreateVideoStore()
const anyLoading = computed(() => vidStore.state.anyLoading)
const loading = computed(() => vidStore.state.loading)
const req = toRef(vidStore.state.req)

function create() {
  void vidStore.createVideoRequest().then(() => emit("created"))
}
const scrollWrapperComponent = computed(() => (quasar.screen.lt.md ? "q-scroll-area" : "div"))
const showBackBtn = computed(() => quasar.screen.lt.md)
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
    height: calc(100vh - 140px);
  }
}
</style>
