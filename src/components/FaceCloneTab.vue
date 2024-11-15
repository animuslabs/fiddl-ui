<template lang="pug">
  div.q-mt-md
    div(v-if="mode == 'pickModel'")
      .centered
        h5 Face Clones
      .centered.q-ma-md
        CustomModelsList(style="width:600px; max-width:90vw;" @modelClicked="selectModel")
      .centered
        q-btn(label="Create Face Clone" @click="mode= 'createModel'" flat color="primary" size="lg")
    div(v-if="mode == 'createModel'")
      div.q-ma-lg
        p Upload 10-20 images of a person's face to create a custom model
        p The more diverse the images, the better the model will be
        p You can use the same person's face in different poses, lighting, and expressions
        p The cost to create a model is 3000 Fiddl points
      .centered.q-ma-md
        UploaderCard(@formData="handleFormData")
    div(v-if="mode == 'watchTraining'")
      .centered
        .q-ma-md
          h5 Training in progress
          p This may take a few minutes
          p You can close this tab and check back later
      div(v-if="trainingData")
        .centered
          div(style="max-width:800px").q-ma-md
            div.q-ma-md
              h4 Status:
              p {{ trainingData.status }}
            div.q-ma-md(v-if="trainingData.logs")
              h4 Logs:
              .full-width(style="height: 200px; overflow-y: auto")
                pre {{ parseTrainingLog(trainingData.logs) }}
            div.q-ma-md(v-if="trainingData.logs")
              h4 Metrics:
              p {{ trainingData.output }}
            div.q-ma-md(v-if="trainingData.error")
              h4 Error:
              p {{ trainingData.error }}
      .centered.q-ma-md
        q-btn(label="Back" @click="mode= 'pickModel'" flat color="primary" size="lg")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"
import CustomModelsList from "./CustomModelsList.vue"
import { catchErr, toObject } from "lib/util"
import { Loading } from "quasar"
import { CustomModel, uploadTrainingImages, type TrainingData } from "lib/api"
import { parseTrainingLog, TrainingLog } from "lib/modelTraining"
let loadTrainingInterval: any = null
export default defineComponent({
  components: {
    UploaderCard,
    CustomModelsList,
  },
  data: function () {
    return {
      mode: "pickModel",
      targetModelId: null as string | null,
      trainingData: null as TrainingData | null,
      parseTrainingLog,
      trainingProgress: null as TrainingLog | null,
    }
  },
  watch: {
    mode: {
      handler(val) {
        if (val == "pickModel") {
          this.targetModelId = null
          this.trainingData = null
        }
        if (val === "watchTraining") {
          void this.loadTrainingData()
          loadTrainingInterval = setInterval(() => void this.loadTrainingData(), 2000)
        } else {
          if (loadTrainingInterval) clearInterval(loadTrainingInterval)
        }
      },
      immediate: true,
    },
  },
  methods: {
    selectModel(model: CustomModel) {
      console.log("Selected model:", model)
      if (model.status == "training") {
        this.targetModelId = model.id
        this.mode = "watchTraining"
      }
    },
    async loadTrainingData() {
      if (!this.targetModelId) return
      this.trainingData = (await this.$api.models.getTrainingStatus.query(this.targetModelId).catch(catchErr)) || null
      console.log("Training data:", toObject(this.trainingData))
    },
    async loadUserModels() {
      // this.models = (await this.$api.models.getModels.query().catch(catchErr)) || []
    },
    async handleFormData(imageData: FormData) {
      Loading.show()
      const modelId = await this.$api.models.createModel.mutate({ name: "test", type: "faceClone" }).catch(catchErr)
      if (!modelId) return Loading.hide()
      console.log("Model ID:", modelId)
      const result = await uploadTrainingImages(modelId, imageData)
      console.log("Upload result:", result)
      this.targetModelId = modelId
      this.mode = "watchTraining"
      void this.loadTrainingData()
      Loading.hide()
      this.$q.notify({ color: "positive", message: "Files uploaded!" })
    },
  },
})
</script>
