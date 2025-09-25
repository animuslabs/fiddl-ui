<template lang="pug">
q-dialog(ref="dialogRef" @hide="onDialogHide")
  q-card.q-dialog-plugin(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw;' : 'width:560px; max-width:95vw;'")
    q-card-section
      h5.q-mt-none.q-mb-none How would you like to edit this image?
    q-separator(color="grey-9")
    q-card-section
      .centered.q-my-sm
        q-img(
          :src="s3Img('uploads/' + props.imageId)"
          fit="contain"
          :img-style="{ objectFit: 'contain' }"
          style="max-height:280px; width:100%; border-radius:8px;"
        )
    q-card-section
      q-input(v-model="notes" type="textarea" autogrow filled color="primary" :counter="160" :maxlength="160" placeholder="e.g., make it brighter, remove the background, add a sunset sky")
    q-separator(color="grey-9")
    q-card-actions(align="right" class="actions")
      // Create actions on the left
      q-btn(
        unelevated
        color="primary"
        :loading="creating"
        :disable="creating"
        label="Create Public"
        @click="startCreate(true)"
      )
      q-btn(
        flat
        color="secondary"
        :loading="creating"
        :disable="creating"
        label="Create Private"
        @click="startCreate(false)"
      )
      q-space
      q-btn(flat label="Advanced" color="secondary" @click="onAdvanced")
      q-btn(unelevated label="Continue" color="primary" :disable="notesTrimmed.length === 0" @click="onApply")
</template>

<script lang="ts" setup>
import { ref, computed } from "vue"
import { useDialogPluginComponent } from "quasar"
import { s3Img } from "lib/netlifyImg"
import { useCreateImageStore } from "src/stores/createImageStore"

const props = defineProps<{ imageId: string }>()
defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const notes = ref("")
const notesTrimmed = computed(() => notes.value.trim())
const creating = ref(false)

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
</style>
