<template lang="pug">
  q-form.create-form.col.fit(@submit.prevent="startCreateKeyboard()" :style="$q.screen.lt.md ? 'padding-bottom: env(safe-area-inset-bottom, 24px);' : ''")
    component(:is="scrollWrapperComponent" :class="{'form-scroll':quasar.screen.lt.md, 'grow-scroll': quasar.screen.gt.sm}")
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
              template(#option="{ itemProps, opt, selected }")
                q-item(v-bind="itemProps")
                  q-item-section(avatar)
                    .ar-preview
                      .ar-box(:style="aspectBoxStyle(String(opt))")
                  q-item-section
                    div {{ opt }}
              template(#selected)
                .row.items-center.no-wrap
                  .ar-preview.q-mr-sm
                    .ar-box(:style="aspectBoxStyle(String(req.aspectRatio || '1:1'))")
                  span {{ req.aspectRatio }}
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
    q-space.form-spacer
    .form-action-bar
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

  // Sora aspect ratio mismatch dialog
  q-dialog(v-model="aspectDialogOpen" :maximized="quasar.screen.lt.md")
    q-card(:style="quasar.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;' : 'width:560px; max-width:100vw;'")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          .row.items-center.q-gutter-sm
            q-icon(name="image_aspect_ratio" color="primary" size="md")
            h6.q-mt-none.q-mb-none Aspect Ratio Notice
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .q-mb-sm
          p Your input image aspect ratio
            span.text-bold.q-ml-xs {{ inputAspectLabel || 'unknown' }}
            |  does not match the selected output aspect
            span.text-bold.q-ml-xs {{ req.aspectRatio }}
            |  for Sora.
          p.q-mt-sm To preserve composition, we will generate a proxy image that matches your selected aspect ratio before animating with Sora.
        .q-mt-md
          .row.items-center.q-gutter-sm
            q-icon(name="schedule" size="xs" color="primary")
            span Expect a short additional delay.
          .row.items-center.q-gutter-sm.q-mt-xs
            q-icon(name="payments" size="xs" color="primary")
            span This adds an extra
            q-badge(color="primary" text-color="white" transparent) +{{ seedreamExtraCost }}
            span points (Seedream4 image).
        q-separator.q-my-md
        .text-caption.text-grey-5
          p Tip: Provide a starting image with
            span.text-bold.q-ml-xs {{ req.aspectRatio }}
            |  and there is no extra charge and the process is faster.
      q-card-actions(align="right")
        q-btn(flat color="secondary" label="Cancel" no-caps @click="aspectDialogOpen = false")
        q-btn(color="primary" label="Continue" no-caps @click="confirmAspectDialog")

  // Quick purchase dialog when insufficient points
  q-dialog(v-model="quickBuyDialogOpen" :maximized="quasar.screen.lt.md")
    q-card(:style="quasar.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;' : 'width:520px; max-width:100vw;'")
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
import { computed, ref, toRef, watch } from "vue"
import { prices } from "stores/pricesStore"
import { img, s3Img } from "lib/netlifyImg"
import UploadedImagesDialog from "components/dialogs/UploadedImagesDialog.vue"
import CreateActionBar from "components/CreateActionBar.vue"
import QuickBuyPointsDialog from "src/components/dialogs/QuickBuyPointsDialog.vue"
import { useUserAuth } from "src/stores/userAuth"
import { events } from "lib/eventsManager"

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
const aspectDialogOpen = ref(false)
const pendingPublicFlag = ref<boolean | null>(null)
const inputImageAspect = ref<number | null>(null)
const inputAspectLabel = ref<string | null>(null)

const isSoraSelected = computed(() => req.value.model === 'sora-2' || req.value.model === 'sora-2-pro')
const seedreamExtraCost = computed(() => prices.image.model?.["seedream4"] ?? 13)

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
  // If Sora with an uploaded start image and aspect mismatch, show dialog first
  const needsAspectCheck = isSoraSelected.value && (!!req.value.uploadedStartImageId || !!req.value.startImageId)
  if (needsAspectCheck) {
    // ensure we have the input image aspect measured
    await ensureInputImageAspect()
    if (inputImageAspect.value && typeof req.value.aspectRatio === 'string') {
      const { w, h } = parseAspect(req.value.aspectRatio)
      const target = Math.max(0.0001, w / Math.max(1, h))
      const mismatch = Math.abs((inputImageAspect.value || target) - target) > 0.01
      if (mismatch) {
        pendingPublicFlag.value = isPublic
        aspectDialogOpen.value = true
        return false
      }
    }
  }
  const targetCost = isPublic ? vidStore.publicTotalCost : vidStore.privateTotalCost
  const available = userAuth.userData?.availablePoints || 0
  if (targetCost > available) {
    quickBuyDialogOpen.value = true
    return false
  }
  try {
    events.createStart("video", { model: req.value.model as any, public: !!req.value.public, cost: targetCost })
  } catch {}
  void vidStore
    .createVideoRequest()
    .then(() => {
      try {
        events.createSuccess("video", { model: req.value.model as any, public: !!req.value.public })
      } catch {}
      emit("created")
    })
  return true
}
function onDialogAccept(ids: string[]) {
  req.value.uploadedStartImageId = ids[0]
}

const scrollWrapperComponent = computed(() => "q-scroll-area")
const showBackBtn = computed(() => quasar.screen.lt.md)
const startingImageUrl = computed(() => {
  if (req.value.startImageId) return img(req.value.startImageId, "md")
  else if (req.value.uploadedStartImageId) return s3Img("uploads/" + req.value.uploadedStartImageId)
  else return false
})

// Load the aspect ratio from the selected uploaded image when it changes
async function ensureInputImageAspect() {
  const url = startingImageUrl.value || null
  if (!url) {
    inputImageAspect.value = null
    inputAspectLabel.value = null
    return null
  }
  try {
    const ratio = await getImageAspect(url)
    inputImageAspect.value = ratio
    inputAspectLabel.value = toAspectLabel(ratio)
    return ratio
  } catch {
    inputImageAspect.value = null
    inputAspectLabel.value = null
    return null
  }
}

function getImageAspect(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => {
      const w = Math.max(1, el.naturalWidth || el.width || 1)
      const h = Math.max(1, el.naturalHeight || el.height || 1)
      resolve(w / h)
    }
    el.onerror = reject
    el.src = url
  })
}

function toAspectLabel(ratio: number): string {
  // Try mapping to a known preset first
  const presets = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9", "9:21", "3:2", "2:3", "5:4", "4:5"] as const
  for (const p of presets) {
    const { w, h } = parseAspect(p)
    const r = w / h
    if (Math.abs(r - ratio) < 0.02) return p
  }
  // Fallback label like ~1.33:1
  const val = Math.round(ratio * 100) / 100
  return `~${val}:1`
}

// React when an uploaded image is picked/changed
watch(
  () => [req.value.uploadedStartImageId, req.value.startImageId],
  () => {
    void ensureInputImageAspect()
  }
)

function confirmAspectDialog() {
  aspectDialogOpen.value = false
  const isPublic = pendingPublicFlag.value ?? (req.value.public ?? true)
  // proceed with normal creation flow
  void (async () => {
    const targetCost = isPublic ? vidStore.publicTotalCost : vidStore.privateTotalCost
    const available = userAuth.userData?.availablePoints || 0
    if (targetCost > available) {
      quickBuyDialogOpen.value = true
      return
    }
    try {
      events.createStart("video", { model: req.value.model as any, public: !!isPublic, cost: targetCost })
    } catch {}
    void vidStore
      .createVideoRequest()
      .then(() => {
        try {
          events.createSuccess("video", { model: req.value.model as any, public: !!isPublic })
        } catch {}
        emit("created")
        // notify to match action bar behavior when proceeding from dialog
        quasar.notify({ color: "positive", message: `Starting video creation ${isPublic ? "(Public)" : "(Private)"} · ${targetCost} points` })
      })
  })()
}

const missingPoints = computed(() => {
  const available = userAuth.userData?.availablePoints || 0
  return Math.max(0, vidStore.totalCost - available)
})

function onQuickBuyComplete() {
  quickBuyDialogOpen.value = false
  void userAuth.loadUserData()
  quasar.notify({ color: "positive", message: "Points added. You can create now." })
}

// ----- aspect ratio preview helpers -----
function parseAspect(r: string | undefined | null): { w: number; h: number } {
  if (!r) return { w: 1, h: 1 }
  const parts = String(r).split(":").map((n) => Number(n))
  const w = parts[0] && isFinite(parts[0]) ? parts[0] : 1
  const h = parts[1] && isFinite(parts[1]) ? parts[1] : 1
  return { w, h }
}
function aspectBoxStyle(r: string): Record<string, string> {
  const boxW = 34
  const boxH = 22
  const { w, h } = parseAspect(r)
  const scale = Math.min(boxW / Math.max(w, 1), boxH / Math.max(h, 1))
  const innerW = Math.max(6, Math.round(w * scale))
  const innerH = Math.max(6, Math.round(h * scale))
  return { width: `${innerW}px`, height: `${innerH}px` }
}
</script>

<style scoped>
.ar-preview {
  width: 34px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  background: transparent;
}
.ar-box {
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  background: transparent;
}
</style>

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

.form-spacer {
  flex: 1 0 auto;
  min-height: 0;
}

.form-action-bar {
  flex-shrink: 0;
  padding-top: 16px;
}

@media (min-width: 768px) {
  .form-action-bar {
    padding-top: 30px;
  }
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
/* Desktop: let the scroll wrapper grow to fill the card */
.grow-scroll {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
@media (max-width: 1000px) {
  .form-scroll {
    height: calc(100vh - 160px);
    height: calc(100dvh - 160px);
  }
}
</style>
