<template lang="pug">
q-page.full-height.full-width.q-px-lg
  .centered
    h1.lobster-font Forge
  .centered.q-mt-md
    p Train custom models with your own images

  // Magic Mirror CTA + Advanced toggle
  .centered.q-mt-lg
    q-btn(
      label="Magic Mirror"
      color="primary"
      rounded
      :size="isAdvanced ? 'md' : 'xl'"
      @click="showMMChoice = true"
      icon="auto_awesome"
    )
  .centered.q-mt-sm
    q-btn(
      :label="isAdvanced ? 'Advanced: ON' : 'Advanced: OFF'"
      :color="isAdvanced ? 'secondary' : 'grey-7'"
      outline
      rounded
      size="sm"
      icon="tune"
      @click="toggleAdvanced"
    )

  // Responsive grid to avoid overflow on mobile (Advanced mode)
  .row.items-start.justify-center.full-width(v-if="mode === 'pick' && isAdvanced")
    .col-12.col-md-6
      PickModel(@selectModel="selectModel" @createModel="mode = 'createModel'")
    .col-12.col-md-6
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

  MagicMirrorDialog(v-model="showMMChoice")
</template>

<script lang="ts">
import CreateModel from "components/CreateModel.vue"
import CreateTrainingSet from "components/CreateTrainingSet.vue"
import PickModel from "components/PickModel.vue"
import UseModel from "components/UseModel.vue"
import WatchTraining from "components/WatchTraining.vue"
import { CustomModel, TrainingSet, type TrainingData } from "lib/api"
import { toCreatePage } from "lib/routeHelpers"
import { catchErr } from "lib/util"
import PickTrainingSet from "src/components/PickTrainingSet.vue"
import { modelsGetCustomModel } from "src/lib/orval"
import { CreateImageRequestWithCustomModel, useCreateImageStore } from "src/stores/createImageStore"
import { useForgeStore } from "src/stores/forgeStore"
import { defineComponent } from "vue"
import { LocalStorage } from "quasar"
import MagicMirrorDialog from "src/components/MagicMirrorDialog.vue"
type forgeMode = "pick" | "createModel" | "train" | "createSet"
export default defineComponent({
  components: {
    PickModel,
    CreateModel,
    WatchTraining,
    UseModel,
    PickTrainingSet,
    CreateTrainingSet,
    MagicMirrorDialog,
  },
  data() {
    return {
      mode: "create" as forgeMode,
      targetModelId: null as string | null,
      trainingData: undefined as TrainingData | undefined,
      targetModelData: undefined as CustomModel | undefined,
      loadTrainingInterval: null as any,
      createStore: useCreateImageStore(),
      forgeStore: useForgeStore(),
      isAdvanced: false,
      showMMChoice: false,
    }
  },
  computed: {},
  watch: {
    "$route.params": {
      handler() {
        console.log("route params changed", this.$route.params)
        this.mode = (this.$route.params?.mode as forgeMode) || "pick"
      },
      immediate: true,
      deep: true,
    },
    "$route.query": {
      async handler() {
        const customModelId = this.$route.query?.customModelId
        if (this.mode == "pick") return
        if (typeof customModelId == "string") {
          const modelResponse = await modelsGetCustomModel({ id: customModelId }).catch(catchErr)
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
        if (val) await this.$router.replace({ params: { mode: this.mode }, query: val ? { ...this.$route.query, customModelId: val } : { ...this.$route.query } })
        else await this.$router.replace({ params: { mode: this.mode }, query: {} })
      },
      immediate: false,
    },
    mode: {
      async handler(val: forgeMode) {
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
    isAdvanced(val: boolean) {
      try {
        LocalStorage.set("isAdvancedUser", val)
      } catch (e) {
        // noop
      }
    },
  },
  unmounted() {
    if (this.loadTrainingInterval) clearInterval(this.loadTrainingInterval)
  },
  mounted() {
    try {
      const stored = LocalStorage.getItem("isAdvancedUser")
      this.isAdvanced = stored === true
    } catch (e) {
      this.isAdvanced = false
    }
  },
  methods: {
    toggleAdvanced() {
      this.isAdvanced = !this.isAdvanced
    },
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
      console.log(model)
      toCreatePage(
        {
          customModelId: model.id,
          customModelName: model.name,
          model: "custom",
          type: "image",
        },
        this.$router,
      )
      // this.createStore.state.customModel = model
      // const newReq: Partial<CreateImageRequestWithCustomModel> = {
      //   customModelId: model.id,
      //   customModelName: model.name,
      //   model: "custom",
      //   prompt: "",
      //   quantity: 3,
      // }
      // this.createStore.setReq(newReq)
      // void this.$router.push({ name: "create", params: { activeTab: "image" } })

      //       if (isImageModel.value) {
      //   const model = customModelId.value ? "custom" : (currentModel.value?.slug as ImageModel) || "core"
      //   useCreateImageStore().setReq({
      //     model,
      //     customModelId: model === "custom" ? customModelId.value : undefined,
      //     customModelName: model === "custom" ? currentModel.value?.name : undefined,
      //   })
      //   void router.push({ name: "create", params: { activeTab: "image" } })
      // } else {
      //   useCreateVideoStore().setReq({ model: (currentModel.value?.slug as VideoModel) || "veo-2" })
      //   void router.push({ name: "create", params: { activeTab: "video" } })
      // }
    },
    async loadTrainingData() {
      if (!this.targetModelId) return
      const data = await this.forgeStore.getTrainingStatus(this.targetModelId).catch(() => undefined)
      this.trainingData = data || undefined
    },
    async loadUserModels() {
      await Promise.all([this.forgeStore.loadUserModels(), this.forgeStore.loadUserTrainingSets()])
    },
  },
})
</script>
