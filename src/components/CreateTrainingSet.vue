<template lang="pug">
div.q-ma-md
  .centered.full-width
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
  .row
    .centered.q-ma-md(v-if="!notEnoughPoints")
      div
        p Upload 15-30 images of a subject or style.
        p.q-mb-sm Adding more high quality images will generally improve the quality of models trained on this set.
        UploaderCard( hideUploadButton)
    .centered(style="max-width:500px;").full-width.q-mt-md
      .row.q-ma-md.q-gutter-md
        .row
          div.q-mr-md
            p.q-mb-sm Pick a name for this training set
            q-input( v-model="setName" outlined)
          div
            p.q-mb-sm Training Set Type
            q-btn(:label="getTrainingSetTypeLabel" color="primary" rounded text-color="white" :icon="getTrainingSetTypeIcon" style="height:56px;")
              q-menu
                q-list(style="max-width:300px;" separator)
                  q-item(
                    v-for="type in trainingSetTypes"
                    :key="type.value"
                    clickable
                    @click="trainingSetType = type.value"
                    v-close-popup
                  )
                    div
                      .row.items-center
                        q-icon(:name="type.icon" size="20px").q-mr-sm
                        h4 {{ type.label }}
                        .col-grow.q-mt-sm
                          .row.items-center
                            span {{ type.description }}

        div
          p.q-mb-sm Describe the subject or style of this training set
          q-input( v-model="setDescription" outlined type="textarea" rows="3" autogrow
            placeholder="e.g. 'A portrait of John Doe' or 'a painting style using bright colors'")
          p.q-mt-sm This description is used during training to help models understand the content.
        .row
          h4 Cost: {{ price.toLocaleString() }} Fiddl Points
      .centered.q-mt-lg
        div
          q-btn( label="Create Training Set" size="lg" icon="photo_library" color="primary"  :disable="!setName || !setDescription || notEnoughPoints || !forgeStore.state.files.length || !trainingSetType " @click="handleFiles")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"
import { zipFiles } from "lib/zipClient"
import { trainingSetsCreateSet, trainingSetsFinalizeSet } from "lib/orval"
import { catchErr, sleep } from "lib/util"
import { useForgeStore } from "src/stores/forgeStore"
import { Dialog, Loading } from "quasar"
import { uploadToPresignedPost, uploadWithProgress } from "lib/api"
import { generateWebpThumbnails } from "../lib/imageUtils"

const trainingSetTypes = [
  {
    label: "Subject",
    value: "subject",
    icon: "face",
    description: "focused on a specific person or object.",
  },
  {
    label: "Style",
    value: "style",
    icon: "palette",
    description: "focused on a specific artistic style or theme.",
  },
]

export default defineComponent({
  components: {
    UploaderCard,
  },
  emits: {},
  data() {
    return {
      trainingSetTypes,
      setName: "" as string | null | number,
      setDescription: "" as string | null | number,
      price: 10,
      forgeStore: useForgeStore(),
      trainingSetType: null as any,
    }
  },
  computed: {
    notEnoughPoints() {
      return this.price > (this.$userAuth.userData?.availablePoints || 0)
    },
    getTrainingSetTypeLabel(): string {
      const found = this.trainingSetTypes.find((t) => t.value === this.trainingSetType)
      return found ? found.label : "Select Type"
    },
    getTrainingSetTypeIcon(): string {
      const found = this.trainingSetTypes.find((t) => t.value === this.trainingSetType)
      return found?.icon || "help"
    },
  },
  methods: {
    async handleFiles() {
      if (!this.setName || !this.setDescription) {
        catchErr("Please provide a name and description for the training set.")
        return
      }
      let targetThumbnail: null | string = null
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
          zipSizeMb: blob.size / 1_000_000,
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
        Loading.show({
          message: "Preparing thumbnails...",
          spinnerSize: 50,
          spinnerColor: "primary",
        })
        const thumbnails = await generateWebpThumbnails(files, 512, 80)
        for (let i = 0; i < thumbnails.length; i++) {
          const file = thumbnails[i]
          const presignedPost = newTrainingSet.signedThumbnailUploadDatas[i]
          if (!file || !presignedPost) continue
          await uploadToPresignedPost({ file, presignedPost })
          Loading.show({
            message: `Uploading thumbnail ${i + 1}/${thumbnails.length}...`,
            spinnerSize: 50,
            spinnerColor: "primary",
          })
        }
        Loading.show({
          message: "Finalizing training set...",
          spinnerSize: 50,
          spinnerColor: "primary",
        })
        await trainingSetsFinalizeSet({
          trainingSetId: newTrainingSet.trainingSetId,
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
