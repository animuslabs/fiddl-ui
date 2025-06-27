<template lang="pug">
div.q-ma-md
  .centered.full-width
    div.q-pa-md.q-ma-md(style="max-width:800px")
      p Upload 15-30 images of a subject or style.
      p Adding more high quality images will generally improve the quality of models trained on this set.
  .centered.q-ma-md(v-if="!notEnoughPoints")
    UploaderCard( hideUploadButton)
  div(v-if="notEnoughPoints").full-width
    .centered
      h5 You don't Have enough Fiddl Points to proceed
    .centered.q-ma-md
      q-btn(
        label="Get more points"
        @click="$router.push({name:'addPoints'})"
        flat
        color="accent"
        size="lg"
      )
  .centered.q-mt-md.q-gutter-md.q-ma-md
    div
      p.q-mb-sm Pick a name for this training set
      q-input( v-model="setName" outlined)
    div
      p.q-mb-sm Describe the subject or style of this training set
      q-input( v-model="setDescription" outlined type="textarea" rows="3" autogrow
        placeholder="e.g. 'A portrait of John Doe' or 'a painting style using bright colors'")
      p.q-mt-sm This description is used during training to help models understand the content.
  .centered
    h4 Cost: {{ price.toLocaleString() }} Fiddl Points
  .centered.q-mt-lg
    q-btn( label="Create Training Set" size="lg" icon="photo_library" color="primary"  :disable="!setName || !setDescription || notEnoughPoints || !forgeStore.state.files.length" @click="handleFiles")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"
import { zipFiles } from "lib/zipClient"
import { trainingSetsCreateSet } from "lib/orval"
import { catchErr, sleep } from "lib/util"
import { useForgeStore } from "src/stores/forgeStore"
import { Dialog, Loading } from "quasar"
import { uploadToPresignedPost, uploadWithProgress } from "lib/api"
export default defineComponent({
  components: {
    UploaderCard,
  },
  emits: {},
  data() {
    return {
      setName: "" as string | null | number,
      setDescription: "" as string | null | number,
      price: 10,
      forgeStore: useForgeStore(),
    }
  },
  computed: {
    notEnoughPoints() {
      return this.price > (this.$userAuth.userData?.availablePoints || 0)
    },
  },
  methods: {
    async handleFiles() {
      if (!this.setName || !this.setDescription) {
        catchErr("Please provide a name and description for the training set.")
        return
      }
      try {
        Loading.show({
          message: "Creating training set...",
          spinnerSize: 50,
          spinnerColor: "primary",
        })
        let files = [...this.forgeStore.state.files]
        console.log("Files received:", files)
        const zipped = await zipFiles(files)
        const blob = new Blob([zipped], { type: "application/zip" })
        console.log("Zipped blob size:", blob.size)
        await sleep(1000) // Simulate delay for UI feedback
        const trainingSetResult = await trainingSetsCreateSet({
          name: String(this.setName),
          description: String(this.setDescription),
          numImages: files.length,
          zipSizeMb: Math.round(blob.size / 1024 / 1024),
        })
        const { data: newTrainingSet, status, statusText } = trainingSetResult
        console.log("New training set created:", newTrainingSet)
        if (status > 201) catchErr("Failed to create training set: " + statusText)
        await uploadWithProgress({
          onProgress: (data) => {
            Loading.show({ message: `Uploading training set... ${data}%`, spinnerSize: 50, spinnerColor: "primary" })
          },
          file: blob,
          presignedPost: newTrainingSet.signedZipUploadData,
        })
      } catch (error) {
        console.error("Error handling files:", error)
        catchErr(error)
        return
      } finally {
        Loading.hide()

        // this.forgeStore.reset()
      }
      Dialog.create({
        title: "Training Set Created",
        message: `Your training set "${this.setName}" has been created successfully!`,
        ok: {
          label: "OK",
          color: "primary",
        },
      })
    },
  },
})
</script>
