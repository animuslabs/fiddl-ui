<template lang="pug">
q-page.q-mb-xl.q-px-lg
  .centered
    h1.lobster-font Forge
  .centered.q-mt-md
    p Train custom models with your own images
  .centered.full-width(v-if="mode === 'pick'")
    .col-6
      PickModel(  @selectModel="selectModel" @createModel="mode = 'createModel'")
    .col-6
      PickTrainingSet(@selectSet="selectSet" @createSet="mode = 'createSet'")
  div(v-if="mode == 'createModel'").full-width
    CreateModel
    .centered
      q-btn(label="back" @click="mode='pick'" color="primary" flat)
  div(v-if="mode == 'createSet'")
    CreateTrainingSet()
    //- .centered
    //-   q-btn(label="back" @click="mode='pick'" color="primary" flat)
  WatchTraining(
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
import { Dialog, Loading, Notify } from "quasar"
import { CustomModel, TrainingSet, uploadTrainingImages, type TrainingData } from "lib/api"
import { parseTrainingLog } from "lib/modelTraining"
import PickModel from "components/PickModel.vue"
import CreateModel from "components/CreateModel.vue"
import WatchTraining from "components/WatchTraining.vue"
import UseModel from "components/UseModel.vue"
import { CreateImageRequestWithCustomModel, useCreateCardStore } from "src/stores/createCardStore"
import { catchErr } from "lib/util"
import PickTrainingSet from "src/components/PickTrainingSet.vue"
import CreateTrainingSet from "components/CreateTrainingSet.vue"
type FaceForgeMode = "pick" | "createModel" | "train" | "createSet"
export default defineComponent({
  components: {
    PickModel,
    CreateModel,
    WatchTraining,
    UseModel,
    PickTrainingSet,
    CreateTrainingSet,
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
        const customModelId = this.$route.query?.customModelId
        if (this.mode == "pick") return
        if (typeof customModelId == "string") {
          const modelResponse = await modelsGetModel({ id: customModelId }).catch(catchErr)
          const customModel = modelResponse?.data
          if (!customModel) {
            this.mode = "pick"
          } else {
            this.selectModel(customModel)
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
      void this.$router.push({ name: "trainingSet", params: { trainingSetId: set.id } })
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
  },
})
</script>
