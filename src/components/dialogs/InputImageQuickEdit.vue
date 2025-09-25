<template lang="pug">
q-card.q-dialog-plugin(:style="$q.screen.lt.md ? 'width:100vw; max-width:100vw;' : 'width:560px; max-width:95vw;'")
  q-card-section
    h5.q-mt-none.q-mb-none How would you like to edit this image?
  q-separator(color="grey-9")
  q-card-section
    .centered.q-my-sm
      q-img(:src="s3Img('uploads/' + props.imageId)" style="max-height:220px; max-width:100%; border-radius:8px; object-fit:contain;")
  q-card-section
    q-input(v-model="notes" type="textarea" autogrow filled color="primary" :counter="160" :maxlength="160" placeholder="e.g., make it brighter, remove the background, add a sunset sky")
  q-separator(color="grey-9")
  q-card-actions(align="right")
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
</script>

<style scoped>
.centered {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
