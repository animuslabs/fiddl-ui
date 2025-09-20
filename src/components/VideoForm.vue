<template lang="pug">
  q-form.create-form.col.fit(@submit.prevent="startCreateKeyboard()" style="padding-bottom: env(safe-area-inset-bottom, 24px);")
    component(:is="scrollWrapperComponent" :class="{'form-scroll':quasar.screen.lt.md}")
      .centered.q-pb-md.relative-position
        q-input.full-width( v-model="vidStore.state.req.prompt" style="resize:none;" :disable="anyLoading" @keydown.enter.prevent="startCreateKeyboard()" color="primary" filled type="textarea" placeholder="Enter a description of the video to create" :autogrow="quasar.screen.lt.md")
        .absolute-bottom-right(style="margin-bottom:30px; margin-right:30px;")
          q-btn(icon="clear" flat @click="vidStore.state.req.prompt = ''" :disable="anyLoading" round)
          q-tooltip(v-if="quasar.screen.gt.sm") Clear Prompt
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
      .centered.settings-grid
        .row.q-col-gutter-md.full-width.items-start
          .col-6.col-md-6
            p.setting-label Aspect Ratio
            q-select(
              v-model="req.aspectRatio"
              :options="vidStore.availableAspectRatios"
              style="font-size:20px;"
              :disable="anyLoading || !!req.startImageId"
              dense
            )
              q-tooltip(v-if="req.startImageId")
                p Starting image determines aspect ratio.
          .col-6.col-md-6
            p.setting-label Duration
            q-select(
              v-model="req.duration"
              :options="vidStore.availableDurations"
              style="font-size:20px;"
              :disable="anyLoading"
              dense
            )
          .col-12.col-md-6(v-if="req.seed != undefined")
            p.setting-label Seed
            .row.items-start.no-wrap.q-gutter-sm
              q-input.col(
                v-model.number="req.seed"
                type="number"
                placeholder="Random"
                clearable
                :disable="anyLoading"
                dense
              )
              .column.col-shrink
                q-btn(size="sm" icon="add" flat round @click="req.seed++" :disable="!req.seed")
                q-btn(size="sm" icon="remove" flat round @click="req.seed--" :disable="!req.seed")

      .row.items-start.wrap.q-ml-md.q-mt-md
        div.relative-position.col-12.col-md-6
          p.setting-label Model
          .row.items-center.relative-position
            q-select.relative-position.text-capitalize(
              v-model="req.model"
              :options="videoModels"
              style="font-size:20px; min-width:140px;"
              :disable="anyLoading"
              dense
            )
              .badge-sm.text-white {{ vidStore.selectedModelPrice }}
            q-btn.q-mt-md.q-ml-md(@click="$router.push({ name: 'models' ,params:{filterTag:'Video'}})" no-caps outline color="primary" icon="list" label="Video Models")
        div.relative-position.col-12.col-md-6
          p.setting-label Starting Image
          q-img.q-mb-sm.q-mt-xs.relative-position(v-if="startingImageUrl" :src="startingImageUrl" style="max-height:200px; min-width:100px;" :class="disableStartingImage?'disabled':''")
            .absolute-center.full-width(v-if="disableStartingImage")
              .centered
                div not supported by model
          q-btn.q-mt-sm(v-if="startingImageUrl" label="Clear" @click="clearStartingImage" icon="close")
          q-btn.q-mt-sm(v-else label="Choose starting Image" @click="showImageDialog = true")
    .full-width(style="height:30px;").gt-sm
    CreateActionBar(
      v-if="$userAuth.userData"
      :publicCost="vidStore.publicTotalCost"
      :privateCost="vidStore.privateTotalCost"
      :disabled="createDisabled"
      :loadingCreate="loading.create"
      :currentPublic="req.public"
      :showBackBtn="showBackBtn"
      :extraDisabled="actionCooldown"
      :onCreate="startCreate"
      caption="Public videos appear in the community feed."
      kind="video"
      @back="$emit('back')"
    )

  UploadedImagesDialog(v-model="showImageDialog" @accept="onDialogAccept" :multiSelect="false" :thumbSizeMobile="95" context="video")

  // Quick purchase dialog when insufficient points
  q-dialog(v-model="quickBuyDialogOpen" :maximized="quasar.screen.lt.md")
    q-card(:style="quasar.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; border-radius:0;' : 'width:520px; max-width:100vw;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Add Fiddl Points
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mb-sm
          p You need {{ missingPoints }} more points to create this video. Purchase a points package below. Your balance updates automatically after payment.
        QuickBuyPointsDialog(@paymentComplete="onQuickBuyComplete")
  </template>

<script lang="ts" setup>
import { videoModels } from "lib/imageModels"
import { useQuasar } from "quasar"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { computed, ref, toRef } from "vue"
import { prices } from "stores/pricesStore"
import { img, s3Img } from "lib/netlifyImg"
import UploadedImagesDialog from "components/dialogs/UploadedImagesDialog.vue"
import CreateActionBar from "components/CreateActionBar.vue"
import QuickBuyPointsDialog from "src/components/dialogs/QuickBuyPointsDialog.vue"
import { useUserAuth } from "src/stores/userAuth"

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
const quickBuyDialogOpen = ref(false)
const actionCooldown = ref(false)

async function startCreateKeyboard() {
  const started = await startCreate()
  if (started) {
    const cost = (req.value.public ?? true) ? vidStore.publicTotalCost : vidStore.privateTotalCost
    quasar.notify({ color: "positive", message: `Starting video creation ${req.value.public ? "(Public)" : "(Private)"} · ${cost} points` })
    actionCooldown.value = true
    setTimeout(() => (actionCooldown.value = false), 2000)
  }
}
const userAuth = useUserAuth()
const vidStore = useCreateVideoStore()
const anyLoading = computed(() => vidStore.state.anyLoading)
const loading = computed(() => vidStore.state.loading)
const req = toRef(vidStore.state.req)
const createDisabled = computed(() => anyLoading.value || (req.value.prompt?.length || 0) < 5)
const disableStartingImage = computed(() => false)
function clearStartingImage() {
  req.value.startImageId = undefined
  req.value.uploadedStartImageId = undefined
}
async function startCreate(isPublic: boolean = req.value.public ?? true) {
  if (createDisabled.value) return false
  req.value.public = isPublic
  const targetCost = isPublic ? vidStore.publicTotalCost : vidStore.privateTotalCost
  const available = userAuth.userData?.availablePoints || 0
  if (targetCost > available) {
    quickBuyDialogOpen.value = true
    return false
  }
  void vidStore.createVideoRequest().then(() => emit("created"))
  return true
}
function onDialogAccept(ids: string[]) {
  req.value.uploadedStartImageId = ids[0]
}

const scrollWrapperComponent = computed(() => (quasar.screen.lt.md ? "q-scroll-area" : "div"))
const showBackBtn = computed(() => quasar.screen.lt.md)
const startingImageUrl = computed(() => {
  if (req.value.startImageId) return img(req.value.startImageId, "md")
  else if (req.value.uploadedStartImageId) return s3Img("uploads/" + req.value.uploadedStartImageId)
  else return false
})

const missingPoints = computed(() => {
  const available = userAuth.userData?.availablePoints || 0
  return Math.max(0, vidStore.totalCost - available)
})

function onQuickBuyComplete() {
  quickBuyDialogOpen.value = false
  void userAuth.loadUserData()
  quasar.notify({ color: "positive", message: "Points added. You can create now." })
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
  /* Prevent tiny horizontal overflow from gutter/margins */
  overflow-x: hidden;
}

.settings-grid {
  width: 100%;
}

.setting-label {
  font-size: 12px;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  height: 700px;
}
@media (max-width: 1000px) {
  .form-scroll {
    height: calc(100vh - 160px);
  }
}
</style>
