<template lang="pug">
q-form.create-form.col.fit(
  @submit.prevent="create"
  style="padding-bottom:env(safe-area-inset-bottom,24px);"
)
  component(:is="scrollWrapperComponent" :class="{'form-scroll':isMobile}")
    .centered.q-pb-md.relative-position
      q-input.full-width(
        v-model="vidStore.state.req.prompt"
        :disable="anyLoading"
        @keydown.enter.prevent="create"
        color="primary"
        filled
        type="textarea"
        placeholder="Enter a description of the video to create"
        autogrow
      )
      .absolute-bottom-right(style="margin-bottom:30px;margin-right:30px;")
        q-btn(icon="clear" flat round @click="vidStore.state.req.prompt=''" :disable="anyLoading")
        q-tooltip Clear Prompt
    .centered.q-ma-md
      q-btn(icon="lightbulb" flat :loading="loading.new" @click="vidStore.newPrompt()" :disable="anyLoading").q-mr-md
        .badge-sm {{ prices.promptTools.randomPrompt }}
      q-btn(icon="shuffle" flat :loading="loading.randomize" @click="vidStore.randomizePrompt()" :disable="anyLoading||vidStore.state.req.prompt?.length<10").q-mr-md
        .badge-sm {{ prices.promptTools.randomPrompt }}
      q-btn(icon="arrow_upward" flat :loading="loading.improve" @click="vidStore.improvePrompt()" :disable="anyLoading||vidStore.state.req.prompt?.length<10")
        .badge-sm {{ prices.promptTools.improvePrompt }}
    q-separator(color="grey-9" spaced="20px" inset)
    .centered.q-gutter-md
      div
        p Quantity
        .row
          q-input(
            v-model.number="vidStore.state.req.quantity"
            type="number"
            :min="1"
            :max="3"
            style="width:45px;max-width:20vw;"
            no-error-icon
            :disable="anyLoading||vidStore.state.req.seed!=undefined"
          )
          q-tooltip(v-if="vidStore.state.req.seed!=undefined") Can't adjust quantity when using custom seed
          .column
            q-btn(size="sm" icon="add" flat round @click="vidStore.state.req.quantity++" :disable="vidStore.state.req.quantity>=3||vidStore.state.req.seed!=undefined")
            q-btn(size="sm" icon="remove" flat round @click="vidStore.state.req.quantity--" :disable="vidStore.state.req.quantity<=1||vidStore.state.req.seed!=undefined")
      div
        p Aspect Ratio
        .row
          q-select(
            v-model="vidStore.state.req.aspectRatio"
            :options="vidStore.availableAspectRatios"
            style="font-size:20px;"
            :disable="anyLoading"
          )
      div
        p Duration
        .row
          q-select(
            v-model="vidStore.state.req.duration"
            :options="vidStore.availableDurations"
            style="font-size:20px;"
            :disable="anyLoading"
          )
      div.q-ma-md(v-if="vidStore.state.req.seed!=undefined")
        p Seed
        .row.no-wrap(style="max-width:150px;")
          q-input(
            v-model.number="vidStore.state.req.seed"
            type="number"
            placeholder="Random"
            clearable
            :disable="anyLoading"
          )
          .column
            q-btn(size="sm" icon="add" flat round @click="vidStore.state.req.seed++" :disable="!vidStore.state.req.seed")
            q-btn(size="sm" icon="remove" flat round @click="vidStore.state.req.seed--" :disable="!vidStore.state.req.seed")
    .row.no-wrap
      div.q-ma-md.relative-position
        p Model
        .row.items-center.relative-position
          .badge-sm {{ vidStore.selectedModelPrice }}
          q-select.text-capitalize(
            v-model="vidStore.state.req.model"
            :options="videoModels"
            style="font-size:20px;"
            :disable="anyLoading"
          )
      div.q-ma-md.relative-position
        p Starting Image
        q-btn.q-mt-sm(label="Choose starting Image" @click="showImageDialog=true")
  .full-width(style="height:30px;").gt-sm
  .centered.relative-position.q-pb-md.q-pt-md.bg-grey-10(v-if="$userAuth.userData")
    div(style="position:absolute;left:15px;top:-10px;")
      q-btn(label="< Back" color="accent" outline @click="emitBack()" v-if="showBack")
    div(style="position:absolute;top:0;")
      q-btn(
        type="submit"
        label="Create"
        color="primary"
        :loading="loading.create"
        :disable="anyLoading||vidStore.totalCost>($userAuth.userData?.availablePoints||0)||vidStore.state.req.prompt.length<5"
      )
        .badge {{ vidStore.totalCost }}
    div(style="position:absolute;right:15px;top:0;")
      q-toggle(
        size="sm"
        v-model="vidStore.state.req.public"
        color="primary"
        :disable="anyLoading"
        :label="vidStore.state.req.public?'Public':'Private'"
      )
q-dialog(v-model="showImageDialog")
  q-card
    .q-ma-md.centered
      h4.q-mb-md Create a video from any creation on Fiddl.art
      p This feature is coming soon!
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { useQuasar } from "quasar"
import { videoModels } from "lib/imageModels"
import { prices } from "stores/pricesStore"
import { useCreateVideoStore } from "src/stores/createVideoStore"

const props = defineProps<{ showBackBtn?: boolean }>()
const emit = defineEmits(["created", "back"])

const quasar = useQuasar()
const isMobile = computed(() => quasar.screen.lt.md)
const scrollWrapperComponent = computed(() => (isMobile.value ? "q-scroll-area" : "div"))

const showImageDialog = ref(false)

const vidStore = useCreateVideoStore()
const anyLoading = computed(() => vidStore.state.anyLoading)
const loading = computed(() => vidStore.state.loading)

function create() {
  void vidStore.createVideoRequest().then(() => emit("created"))
}

function emitBack() {
  emit("back")
}

const showBack = computed(() => props.showBackBtn ?? isMobile.value)

function setVh() {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`)
}

onMounted(() => {
  setVh()
  window.addEventListener("resize", setVh, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", setVh)
})
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
    height: calc(var(--vh, 1vh) * 100 - 140px);
  }
}
</style>
