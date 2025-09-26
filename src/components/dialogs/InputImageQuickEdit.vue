<template lang="pug">
q-dialog(ref="dialogRef" @hide="onDialogHide" :maximized="$q.screen.lt.md")
  q-card.q-dialog-plugin(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw; height:100vh; height:100dvh; border-radius:0;' : 'width:560px; max-width:95vw;'")
    q-card-section
      h5.q-mt-none.q-mb-none How would you like to edit this image?
    q-separator(color="grey-9")
    q-card-section
      .centered.q-my-sm
        q-img(
          :src="compressedUrl(props.imageId, 'md')"
          fit="contain"
          :img-style="{ objectFit: 'contain' }"
          style="max-height:320px; width:100%; border-radius:8px;"
        )
      // Other images already included in this request (exclude current)
      div(v-if="otherItems.length" class="q-mt-md")
        .text-caption.text-grey-5.q-mb-xs Other images in this request (tap x to remove):
        StartImageThumbs(:items="otherItems" :size="$q.screen.lt.md ? 56 : 64" :gap="8" @remove="removeOther")
    q-card-section
      q-input(v-model="notes" type="textarea" autogrow filled color="primary" :counter="160" :maxlength="160" placeholder="e.g., make it brighter, remove the background, add a sunset sky")
    // Quick model select (only models that support input images)
    q-card-section
      p.setting-label Model
      q-select(
        v-model="selectedModel"
        :options="quickModels"
        option-label="label"
        option-value="slug"
        emit-value
        map-options
        dense
        outlined
        color="primary"
      )
      .text-caption.text-grey-5.q-mt-xs(v-if="!supportsMulti") Selected model only supports a single input image.
    q-separator(color="grey-9")
    q-card-actions(align="right" class="actions")
      q-btn(
        unelevated
        color="primary"
        :loading="creating"
        :disable="creating"
        :dense="$q.screen.lt.md"
        :size="$q.screen.lt.md ? 'sm' : 'md'"
        label="Create Public"
        @click="startCreate(true)"
      )
      q-btn(
        flat
        color="secondary"
        :loading="creating"
        :disable="creating"
        :dense="$q.screen.lt.md"
        :size="$q.screen.lt.md ? 'sm' : 'md'"
        label="Create Private"
        @click="startCreate(false)"
      )
      q-space
      q-btn(flat label="Advanced" color="secondary" @click="onAdvanced" :dense="$q.screen.lt.md" :size="$q.screen.lt.md ? 'sm' : 'md'")
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useDialogPluginComponent } from "quasar"
import { compressedUrl } from "lib/imageCdn"
import { useCreateImageStore } from "src/stores/createImageStore"
import { toCreatePage } from "lib/routeHelpers"
import StartImageThumbs from "components/StartImageThumbs.vue"

const props = defineProps<{ imageId: string }>()
defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const notes = ref("")
const notesTrimmed = computed(() => notes.value.trim())
const creating = ref(false)
const router = useRouter()
const store = useCreateImageStore()

type StartImageItem = { id: string; source: "uploaded" | "existing" }

// Which models are available for quick selection and their capabilities
const quickModels = [
  { slug: "nano-banana", label: "Nano Banana", multi: true },
  { slug: "gpt-image-1", label: "GPT-Image", multi: true },
  { slug: "flux-dev", label: "Flux Dev", multi: false },
  { slug: "flux-pro", label: "Flux Pro", multi: false },
  { slug: "flux-pro-ultra", label: "Flux Ultra", multi: false },
  { slug: "photon", label: "Photon", multi: false },
]
const quickModelSlugs = new Set(quickModels.map((m) => m.slug))
const selectedModel = computed<string>({
  get() {
    return store.state.req.model as string
  },
  set(v: string) {
    store.state.req.model = v as any
  },
})
const supportsMulti = computed(() => ["nano-banana", "gpt-image-1"].includes(selectedModel.value))

const otherItems = computed<StartImageItem[]>(() => {
  const items: StartImageItem[] = []
  const startIds = store.state.req.startImageIds || []
  for (const id of startIds) if (id !== props.imageId) items.push({ id, source: "existing" })
  const upIds = store.state.req.uploadedStartImageIds || []
  for (const id of upIds) if (id !== props.imageId) items.push({ id, source: "uploaded" })
  // Hide list when current model is single-input
  return supportsMulti.value ? items : []
})

function removeOther(item: StartImageItem) {
  if (item.source === "existing") {
    const next = (store.state.req.startImageIds || []).filter((x) => x !== item.id)
    store.setReq({ startImageIds: next })
  } else {
    const next = (store.state.req.uploadedStartImageIds || []).filter((x) => x !== item.id)
    store.setReq({ uploadedStartImageIds: next })
  }
}

function onAdvanced() {
  // Ensure current note is applied to the create store prompt
  const text = notesTrimmed.value
  if (text.length > 0) {
    store.setReq({ prompt: text })
  }
  // Coerce images for the currently selected model (single vs multi)
  coerceImagesForModel()

  // Make selections permanent: disable randomizer and persist current model
  store.state.randomizer.enabled = false
  store.saveRandomizer()
  // Persist model to LocalStorage as well so the create card is prefilled
  store.setReq({ model: store.state.req.model as any })

  // Navigate to the Create page with the selected model.
  // Do not suppress the create panel; users want advanced controls.
  toCreatePage(
    {
      type: "image",
      model: store.state.req.model as any,
      customModelId: store.state.req.customModelId,
      customModelName: store.state.req.customModelName,
    },
    router,
  )
  onDialogCancel()
}

function onApply() {
  const text = notesTrimmed.value
  if (text.length > 0) {
    const store = useCreateImageStore()
    store.setReq({ prompt: text })
  }
  onDialogOK()
}

async function startCreate(isPublic: boolean) {
  const store = useCreateImageStore()
  // Apply note as prompt if provided
  const text = notesTrimmed.value
  if (text.length > 0) store.setReq({ prompt: text })
  // Set public/private and start creation
  creating.value = true
  try {
    store.state.req.public = isPublic
    // Make model choice permanent for this session: disable randomizer and persist
    store.state.randomizer.enabled = false
    store.saveRandomizer()
    store.setReq({ model: store.state.req.model as any })
    await Promise.resolve(store.createImage())
    // After triggering creation, navigate to Create page without auto-opening panel on mobile
    toCreatePage(
      {
        type: "image",
        model: store.state.req.model as any,
        customModelId: store.state.req.customModelId,
        customModelName: store.state.req.customModelName,
      },
      router,
      { noCreateModal: true },
    )
  } finally {
    creating.value = false
    onDialogOK()
  }
}

// Coerce selected images to be compatible with the chosen model
function coerceImagesForModel() {
  if (supportsMulti.value) return
  // Single-input: keep only the main image shown in this dialog
  const keep = props.imageId
  store.setReq({ startImageIds: [keep], uploadedStartImageIds: [] })
}

// Model is selected via dropdown; watcher below coerces images

onMounted(() => {
  // Default to nano-banana on this quick-edit screen
  selectedModel.value = "nano-banana"
  coerceImagesForModel()
})

// Also react when model changes from outside while dialog is open
watch(
  () => selectedModel.value,
  () => coerceImagesForModel(),
)
</script>

<style scoped>
.centered {
  display: flex;
  align-items: center;
  justify-content: center;
}
.actions {
  flex-wrap: wrap;
  gap: 8px;
}
.setting-label {
  font-size: 12px;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
