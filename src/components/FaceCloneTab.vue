<template lang="pug">
  div
    div(v-if="mode == 'pickModel'").q-mt-md
      .centered
        h5 Face Clones
      .centered.q-ma-md
        CustomModelsList(style="width:600px; max-width:90vw;" @modelClicked="selectModel")
      .centered
        q-btn(label="Create Face Clone" @click="mode= 'createModel'" flat color="primary" size="lg")
    div(v-if="mode == 'createModel'").q-mt-md
      div.q-ma-lg
        p Upload 10-20 images of a person's face to create a custom model
        p The more diverse the images, the better the model will be
        p You can use the same person's face in different poses, lighting, and expressions
        p The cost to create a model is 3000 Fiddl points
      .centered.q-ma-md
        UploaderCard(@formData="handleFormData")
    div(v-if="mode == 'watchTraining'").q-mt-md
      .centered
        .q-ma-md
          h5 Training in progress
          p This will take 10 - 20 minutes
          p This page will automatically update when training is complete
      div(v-if="trainingData")
        .centered
          div(style="max-width:800px").q-ma-md
            div.q-ma-md(v-if="trainingData.logs")
              h4 Status:
              .full-width(style="height: 200px; overflow-y: auto")
                p {{ trainingData.status }}
                pre {{ trainingProgress }}
      .centered.q-ma-md
        q-btn(label="Back" @click="mode= 'pickModel'" flat color="primary" size="lg")
    div(v-if="mode == 'useModel'")
      PromptTab(:customModel="targetModelData" v-if="targetModelData" :id="0")
      //- .centered
      //-   .q-ma-md
      //-     h5 Model trained
      //-     p You can now use this model to create images
      //-     p You can also train the model further by adding more images
      //- .centered.q-ma-md
      //-   q-btn(label="Back" @click="mode= 'pickModel'" flat color="primary" size="lg")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"
import CustomModelsList from "./CustomModelsList.vue"
import { catchErr, toObject } from "lib/util"
import { Loading } from "quasar"
import { CustomModel, uploadTrainingImages, type TrainingData } from "lib/api"
import { parseTrainingLog, TrainingLog } from "lib/modelTraining"
import PromptTab from "./PromptTab.vue"
let loadTrainingInterval: any = null
export default defineComponent({
  components: {
    UploaderCard,
    CustomModelsList,
    PromptTab,
  },
  data: function () {
    return {
      mode: "pickModel",
      targetModelId: null as string | null,
      trainingData: null as TrainingData | null,
      parseTrainingLog,
      targetModelData: null as CustomModel | null,
    }
  },
  computed: {
    trainingProgress() {
      if (!this.trainingData?.logs) return null
      return parseTrainingLog(this.trainingData.logs)
    },
  },
  watch: {
    targetModelId: {
      handler(val) {
        console.log("Target model ID:", val)
        if (val) void this.$router.replace({ query: { faceCloneId: val } })
      },
      immediate: true,
    },
    mode: {
      handler(val) {
        if (val == "pickModel") {
          this.targetModelId = null
          this.trainingData = null
        }
        if (val === "watchTraining") {
          void this.loadTrainingData()
          loadTrainingInterval = setInterval(() => void this.loadTrainingData(), 5000)
        } else {
          if (loadTrainingInterval) clearInterval(loadTrainingInterval)
        }
      },
      immediate: true,
    },
  },
  methods: {
    selectModel(model: CustomModel | null) {
      if (!model) {
        this.targetModelId = null
        this.targetModelData = null
        this.mode = "pickModel"
        return
      }
      console.log("Selected model:", model)
      this.targetModelId = model.id
      this.targetModelData = model
      if (model.status == "training") {
        this.targetModelId = model.id
        this.mode = "watchTraining"
      } else if (model.status == "trained") {
        this.mode = "useModel"
      }
    },
    async loadTrainingData() {
      if (!this.targetModelId) return
      this.trainingData = (await this.$api.models.getTrainingStatus.query(this.targetModelId).catch(catchErr)) || null
    },
    async loadModelData() {
      if (!this.targetModelId) return
      this.targetModelData = (await this.$api.models.getModel.query(this.targetModelId).catch(catchErr)) || null
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
