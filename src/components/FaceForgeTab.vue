<template lang="pug">
div
  PickModelComponent(
    v-if="mode === 'pickModel'"
    @selectModel="selectModel"
    @createModel="mode = 'createModel'"
  )
  CreateModelComponent(
    v-if="mode === 'createModel'"
    :notEnoughPoints="notEnoughPoints"
    :pricingMap="pricingMap"
    :trainingModes="trainingModes"
    @startTraining="startTraining"
  )
  WatchTrainingComponent(
    v-if="mode === 'watchTraining'"
    :trainingData="trainingData"
    @back="mode = 'pickModel'"
  )
  UseModelComponent(
    v-if="mode === 'useModel'"
    :customModel="targetModelData"
  )
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { Loading } from "quasar"
import { CustomModel, uploadTrainingImages, type TrainingData } from "lib/api"
import { parseTrainingLog } from "lib/modelTraining"
import PickModelComponent from "./PickModel.vue"
import CreateModelComponent from "./CreateModel.vue"
import WatchTrainingComponent from "./WatchTraining.vue"
import UseModelComponent from "./UseModel.vue"

const trainingModes = ["simple", "normal", "advanced", "extreme"] as const
type FaceForgeMode = (typeof trainingModes)[number]

export const pricingMap: Record<FaceForgeMode, number> = {
  simple: 3000,
  normal: 6000,
  advanced: 15000,
  extreme: 35000,
}
const defaultTrainingData = {}

export default defineComponent({
  components: {
    PickModelComponent,
    CreateModelComponent,
    WatchTrainingComponent,
    UseModelComponent,
  },
  data() {
    return {
      mode: "pickModel",
      trainingModes,
      pricingMap,
      targetModelId: null as string | null,
      trainingData: undefined as TrainingData | undefined,
      targetModelData: undefined as CustomModel | undefined,
      loadTrainingInterval: null as any,
    }
  },
  computed: {
    notEnoughPoints() {
      return (this.$userAuth.userData?.availablePoints || 0) < 3000
    },
    trainingProgress() {
      if (!this.trainingData?.logs) return null
      return parseTrainingLog(this.trainingData.logs)
    },
  },
  watch: {
    $userAuth: {
      handler(val) {
        if (val.loggedIn) {
          void this.$userAuth.loadUserData()
          void this.loadUserModels()
        }
      },
      immediate: true,
    },
    targetModelId: {
      handler(val) {
        if (val) void this.$router.replace({ query: { faceForgeId: val } })
      },
      immediate: true,
    },
    mode: {
      handler(val) {
        if (val === "pickModel") {
          this.targetModelId = null
          this.trainingData = undefined
        }
        if (val === "watchTraining") {
          void this.loadTrainingData()
          this.loadTrainingInterval = setInterval(() => void this.loadTrainingData(), 5000)
        } else {
          if (this.loadTrainingInterval) clearInterval(this.loadTrainingInterval)
        }
      },
      immediate: true,
    },
  },
  methods: {
    selectModel(model: CustomModel | null) {
      if (!model) {
        this.targetModelId = null
        this.targetModelData = undefined
        this.mode = "pickModel"
        return
      }
      this.targetModelId = model.id
      this.targetModelData = model
      if (model.status === "training") {
        this.mode = "watchTraining"
      } else if (model.status === "trained") {
        this.mode = "useModel"
      }
    },
    async loadTrainingData() {
      if (!this.targetModelId) return
      this.trainingData = (await this.$api.models.getTrainingStatus.query(this.targetModelId).catch(() => undefined)) || undefined
    },
    async loadUserModels() {
      // Load user models if needed
    },
    async startTraining({ modelName, trainingMode, formData }: { modelName: string; trainingMode: FaceForgeMode; formData: FormData }) {
      try {
        Loading.show({ message: "Uploading files" })
        const modelId = await this.$api.models.createModel
          .mutate({
            name: modelName,
            type: "faceForge",
            trainingPreset: trainingMode,
          })
          .catch(() => null)
        if (!modelId) return Loading.hide()
        await uploadTrainingImages(modelId, formData)
        this.targetModelId = modelId
        this.mode = "watchTraining"
        void this.loadTrainingData()
        Loading.hide()
        this.$q.notify({ color: "positive", message: "Files uploaded!" })
      } catch (err: any) {
        Loading.hide()
        this.$q.dialog({
          color: "negative",
          message: "Error uploading files: " + err.message,
        })
      }
    },
  },
})
</script>
