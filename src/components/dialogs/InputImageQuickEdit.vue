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
import { ref, computed } from "vue"
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

const otherItems = computed<StartImageItem[]>(() => {
  const items: StartImageItem[] = []
  const startIds = store.state.req.startImageIds || []
  for (const id of startIds) if (id !== props.imageId) items.push({ id, source: "existing" })
  const upIds = store.state.req.uploadedStartImageIds || []
  for (const id of upIds) if (id !== props.imageId) items.push({ id, source: "uploaded" })
  return items
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
</style>
