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
  .centered
    div(v-if="!notEnoughPoints")
      div
        p Upload 15-30 images of a subject or style. Maximum 100 images per training set.
        p.q-mb-md Adding more high quality images will generally improve the quality of models trained on this set.
        UploaderCard( hideUploadButton style="max-width:600px;" :maxFiles="100")

      div(style="max-width:600px; min-width:300px;").full-width.q-mt-md
        .row.q-gutter-sm.full-width
          .col-5.q-mr-md
            p.q-mb-sm Name
            q-input( v-model="setName" filled)
          .col
            p.q-mb-sm Note (optional)
            q-input( v-model="setDescription" filled type="textarea" :rows="3" )

        .centered.q-mt-lg
          div
            q-btn( label="Create Training Set" size="lg" icon="photo_library" color="primary"  :disable="!setName || notEnoughPoints || !forgeStore.state.files.length || forgeStore.state.files.length > 100" @click="handleFiles")
              .badge
                p {{ prices.forge.createTrainingSet }}
        .centered
          p.q-mt-md Once created, a Training Set can be used to train multiple models.
  q-dialog( v-model="finishModal" persistent )
    q-card.q-pa-md
      q-card-section
        .row.items-center
            q-icon.q-mr-md(name="check" size="64px" color="primary").q-mb-md
            h3 Training Set Created
        p Your training set #[strong {{setName}}] has been created successfully!
        p You can now use this set to train models.
      q-card-actions
        q-btn(label="Create Model", color="primary" flat @click="$router.push({name:'forge',params:{mode:'createModel'},query:{trainingSetId:newTrainingSetId}})")
        q-btn(label="Forge Home", color="primary", @click="$router.push({name:'forge'})" flat)
</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"
import { zipFiles } from "lib/zipClient"
import { trainingSetsCreateSet, trainingSetsFinalizeSet } from "lib/orval"
import { catchErr, sleep, throwErr } from "lib/util"
import { useForgeStore } from "src/stores/forgeStore"
import { Dialog, Loading } from "quasar"
import { uploadToPresignedPost, uploadWithProgress } from "lib/api"
import { generateWebpThumbnails } from "../lib/imageUtils"
import { prices } from "src/stores/pricesStore"

// const trainingSetTypes: {
//   label: string
//   value: TrainingSetType
//   icon: string
//   description: string
// }[] = [
//   {
//     label: "Subject",
//     value: "subject",
//     icon: "face",
//     description: "focused on a specific person or object.",
//   },
//   {
//     label: "Style",
//     value: "style",
//     icon: "palette",
//     description: "focused on a specific artistic style or theme.",
//   },
//   {
//     label: "Object",
//     value: "object",
//     icon: "palette",
//     description: "focused on a specific artistic style or theme.",
//   },
// ]

export default defineComponent({
  components: {
    UploaderCard,
  },
  emits: {},
  data() {
    return {
      prices,
      setName: "" as string | null | number,
      setDescription: "" as string | null | number,
      price: 10,
      forgeStore: useForgeStore(),
      finishModal: false as boolean,
      newTrainingSetId: null as string | null,
      loading: true,
    }
  },
  computed: {
    notEnoughPoints() {
      return this.price > (this.$userAuth.userData?.availablePoints || 0)
    },
  },
  methods: {
    async handleFiles() {
      if (!this.setName) {
        catchErr("Please provide a name for the training set.")
        return
      }
      // Enforce 100-image cap
      if (this.forgeStore.state.files.length > 100) {
        catchErr(new Error(`Training sets can include at most 100 images. You currently have ${this.forgeStore.state.files.length}.`))
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
        const zipBuffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
        const blob = new Blob([zipBuffer], { type: "application/zip" })
        console.log("Zipped blob size:", blob.size)
        const trainingSetResult = await trainingSetsCreateSet({
          name: String(this.setName),
          description: String(this.setDescription),
          numImages: files.length,
          zipSizeMb: Math.ceil(blob.size / 1_000_000),
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
        this.newTrainingSetId = newTrainingSet.trainingSetId
        this.finishModal = true
      } catch (error) {
        console.error("Error handling files:", error)
        catchErr(error)
        return
      } finally {
        Loading.hide()

        // this.forgeStore.reset()
      }
    },
  },
})
</script>
