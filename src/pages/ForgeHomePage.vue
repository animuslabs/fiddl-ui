<template lang="pug">
q-page.q-mb-xl
  .centered
    h1.lobster-font Forge
  .centered.q-mt-md
    p Train custom models with your own images
  .centered.full-width(v-if="mode === 'pick'")
    .col-6
      PickModel(  @selectModel="selectModel" @createModel="mode = 'create'")
    .col-6
      PickTrainingSet(@selectSet="selectSet" @createSet="mode = 'createSet'")
  div(v-if="mode == 'create'")
    CreateModel(@startTraining="startTraining")
    .centered
      q-btn(label="back" @click="mode='pick'" color="primary" flat)
  div(v-if="mode == 'createSet'")
    CreateTrainingSet()
    .centered
      q-btn(label="back" @click="mode='pick'" color="primary" flat)
  WatchTrainingComponent(
    v-if="mode === 'train' && targetModelData"
    :trainingData="trainingData"
    :modelData="targetModelData"
    @back="pickMode()"
    @finished="useModel(targetModelData)"
  )
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { modelsGetModel, modelsGetTrainingStatus, modelsCreateModel } from "src/lib/orval"
import { useQuasar } from "quasar"
import { Loading } from "quasar"
import { CustomModel, TrainingSet, uploadTrainingImages, type TrainingData } from "lib/api"
import { parseTrainingLog } from "lib/modelTraining"
import PickModel from "components/PickModel.vue"
import CreateModel from "components/CreateTrainingSet.vue"
import WatchTraining from "components/WatchTraining.vue"
import UseModel from "components/UseModel.vue"
import { CreateImageRequestWithCustomModel, useCreateCardStore } from "src/stores/createCardStore"
import { catchErr } from "lib/util"
import PickTrainingSet from "src/components/PickTrainingSet.vue"
import CreateTrainingSet from "components/CreateTrainingSet.vue"
type FaceForgeMode = "pick" | "create" | "train" | "createSet"
export default defineComponent({
  components: {
    PickModel,
    CreateModel,
    WatchTraining,
    UseModel,
    PickTrainingSet,
    CreateTrainingSet,
  },
  setup() {
    const $q = useQuasar()
    return { $q }
  },
  data() {
    return {
      mode: "create" as FaceForgeMode,
      targetModelId: null as string | null,
      trainingData: undefined as TrainingData | undefined,
      targetModelData: undefined as CustomModel | undefined,
      loadTrainingInterval: null as any,
      createStore: useCreateCardStore(),
    }
  },
  computed: {
    trainingProgress() {
      if (!this.trainingData?.logs) return null
      return parseTrainingLog(this.trainingData.logs)
    },
  },
  watch: {
    "$route.params": {
      handler() {
        console.log("route params changed", this.$route.params)
        this.mode = (this.$route.params?.mode as FaceForgeMode) || "pick"
      },
      immediate: true,
      deep: true,
    },
    "$route.query": {
      async handler() {
        const targetfaceForgeId = this.$route.query?.faceForgeId
        if (this.mode == "pick") return
        if (targetfaceForgeId && typeof targetfaceForgeId == "string") {
          const modelResponse = await modelsGetModel({ id: targetfaceForgeId }).catch(catchErr)
          const faceForgeModel = modelResponse?.data
          if (!faceForgeModel) {
            this.mode = "pick"
          } else {
            this.selectModel(faceForgeModel)
          }
        }
      },
      immediate: true,
      deep: true,
    },
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
      async handler(val) {
        if (val) await this.$router.replace({ params: { mode: this.mode }, query: { faceForgeId: val } })
        else await this.$router.replace({ params: { mode: this.mode }, query: {} })
      },
      immediate: false,
    },
    mode: {
      async handler(val: FaceForgeMode) {
        console.log("mode changed", val, this.$route.query)
        setTimeout(() => {
          void this.$router.replace({ params: { mode: val }, query: { ...this.$route.query } })
        }, 100)
        if (val === "pick") {
          this.targetModelId = null
          this.trainingData = undefined
        }
        if (val === "train") {
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
    selectSet(set: TrainingSet) {
      console.log("selected set", set)
    },
    async pickMode() {
      // await this.$router.replace({ params: { mode: "pick" }, query: {} })
      this.mode = "pick"
    },
    selectModel(model: CustomModel | null) {
      if (model?.status === "trained") return this.useModel(model)
      console.log("select   model", model)
      if (!model) {
        this.targetModelId = null
        this.targetModelData = undefined
        this.mode = "pick"
        return
      }
      this.targetModelId = model.id
      this.targetModelData = model
      if (model.status === "training") {
        this.mode = "train"
        void this.loadTrainingData()
      }
    },
    useModel(model: CustomModel) {
      this.createStore.customModel = model
      const newReq: Partial<CreateImageRequestWithCustomModel> = {
        customModelId: model.id,
        customModelName: model.name,
        model: "custom",
        prompt: "",
        quantity: 4,
      }
      this.createStore.setReq(newReq)
      void this.$router.push({ name: "create" })
    },
    async loadTrainingData() {
      if (!this.targetModelId) return
      const trainingResponse = await modelsGetTrainingStatus({ id: this.targetModelId }).catch(() => undefined)
      this.trainingData = trainingResponse?.data || undefined
    },
    async loadUserModels() {
      // Load user models if needed
    },
    async startTraining({ modelName, trainingMode, formData }: { modelName: string; trainingMode: string; formData: FormData }) {
      try {
        Loading.show({ message: "Uploading files" })
        const modelResponse = await modelsCreateModel({
          name: modelName,
          type: "faceForge",
          trainingPreset: trainingMode as any,
        }).catch(() => null)

        const modelId = modelResponse?.data
        if (!modelId) return Loading.hide()
        await uploadTrainingImages(modelId, formData, (progress) => {
          console.log(`Upload progress: ${progress.toFixed(2)}%`)
          Loading.show({ message: `Uploading files: ${progress.toFixed(2)}%` })
        })
        this.targetModelId = modelId
        this.mode = "train"
        void this.loadTrainingData()
        Loading.hide()
        this.$q?.notify({ color: "positive", message: "Files uploaded!" })
      } catch (err: any) {
        Loading.hide()
        this.$q?.dialog({
          color: "negative",
          message: "Error uploading files: " + err.message,
        })
      }
    },
  },
})
</script>
