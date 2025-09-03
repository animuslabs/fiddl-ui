<template lang="pug">
  q-list(v-if="models?.length" style="max-width:100%;")
    q-item(v-for="model in models" :key="model.id")
      .row.q-gutter-xs.items-center
        .col-auto
          .row
            q-btn(icon="delete" flat color="accent" @click="deleteModel(model)" round)
          .row
            q-btn(icon="edit" flat color="white" @click="editModelName(model)" round)
          .row
            q-btn(:icon="privacyIcon(model)" flat color="white" @click="toggleModelPrivacy(model)" round)
        .col.cursor-pointer(@click.native="handleModelClick(model)" v-if="quasar.screen.width > 500")
          .q-ml-md(style="text-transform: capitalize;")
            h3 {{ model.name }}
          .row.q-gutter-md.full-width
            .col-auto(style="width:100px;")
              p Status
              h4 {{ model.status }}
            .col-auto(style="min-width:100px;")
              p Created
              h5 {{ timeSince(new Date(model.createdAt)) }}
            .col-auto(style="width:120px;")
              p Base Model
              h4(style="text-transform:capitalize") {{ model.modelType }}
            .col-auto(style="width:120px;")
              p Mode
              h4(style="text-transform:capitalize") {{ model.mode }}
            .col-auto(style="width:120px;")
              p Type
              h4(style="text-transform:capitalize") {{ transformType(model) }}
          .row.q-ml-md
            .col-auto(v-if="model.imageRequests.length")
              .full-width.q-mt-md
              .row
                div
                div(v-for="imageRequest in model.imageRequests" :key="imageRequest.id")
                  .relative-position(style="width:60px; height:90px;")
                    img(:src="img((imageRequest.images[0]?.id||''),'md')" style="width:100px; height:100px; object-fit:cover; border-radius:25px; position:absolute; bottom:-5px; box-shadow: 0px 1px 15px rgba(0,0,0,.5) !important")
              .lt-md.full-width.q-mt-md
        .col.cursor-pointer(@click.native="handleModelClick(model)" v-else)
          .row.q-ml-sm
            .col-auto
              h4(style="width:250px; overflow:hidden").ellipsis {{ model.name }}
            .col-auto.q-mr-md
                small Status
                p {{ model.status }}
            .col-auto.q-mr-md
              small Created
              p {{ timeSince(new Date(model.createdAt)) }}
            //- .col-auto
            //-   small Preset
            //-   h6(style="text-transform:capitalize") {{ model. }}
          .row
            .col-auto(v-if="model.imageRequests.length").q-mt-sm
              .lt-md.full-width
              .row
                .q-ml-sm
                div(v-for="imageRequest in model.imageRequests" :key="imageRequest.id")
                  .relative-position(style="width:30px; height:20px;")
                    img(:src="img((imageRequest.images[0]?.id||''),'md')" style="width:50px; height:50px; object-fit:cover; border-radius:5px; position:absolute; bottom:-25px; box-shadow: 0px 1px 15px rgba(0,0,0,.5) !important")
              .lt-md.full-width.q-mt-md
        .full-width
          q-separator(color="grey-9" spaced="20px")

  div(v-else)
    .full-width(style="height: '100px'")
      .centered
        h6 No custom models, create one to get started
  q-dialog(ref="editModelDialog" v-model="showEditNameDialog")
    q-card
      .q-ma-md
        h5.q-mb-sm Edit Model Name
        q-input.q-mb-lg(v-model="newModelName" )
        .row.q-gutter-md
          q-btn(label="Cancel" @click="showEditNameDialog=false" color="accent" flat)
          .col-grow
          q-btn(label="Update" @click="setModelName()" color="primary" flat)
</template>
<script lang="ts">
import { CustomModel, CustomModelWithRequests } from "lib/api"
import { catchErr } from "lib/util"
import { Dialog, Notify, useQuasar } from "quasar"
import { defineComponent } from "vue"
import { modelsSetModelPrivacy, modelsDeleteModel, modelsEditModel } from "src/lib/orval"
import { timeSince } from "lib/util"
import { img } from "lib/netlifyImg"
import { useForgeStore } from "src/stores/forgeStore"

export default defineComponent({
  components: {},
  props: {
    trainedOnly: {
      type: Boolean,
      default: false,
      required: false,
    },
    trainingSetId: {
      type: String,
      default: undefined,
      required: false,
    },
  },
  emits: {
    modelClicked: (model: CustomModel) => true,
  },
  data: function () {
    return {
      quasar: useQuasar(),
      forgeStore: useForgeStore(),
      models: [] as CustomModelWithRequests[] | null,
      timeSince,
      img,
      newModelName: "",
      newModelDescription: "" as string | null,
      showEditNameDialog: false,
      editingModelNameId: null as string | null,
    }
  },
  computed: {},
  watch: {
    "$userAuth.loggedIn": {
      async handler(val) {
        if (!val) return (this.models = [])
        await this.loadData()
      },
      immediate: true,
    },
    trainedOnly: {
      handler() {
        void this.loadData()
      },
    },
    trainingSetId: {
      handler() {
        void this.loadData()
      },
    },
    "forgeStore.state.userModels": {
      handler() {
        const base = this.forgeStore.state.userModels || []
        let models = base
        if (this.trainedOnly) models = models.filter((m) => m.status === "trained")
        if (this.trainingSetId) models = models.filter((m) => m.trainingSetId === this.trainingSetId)
        this.models = models as any
      },
      immediate: true,
      deep: true,
    },
  },
  mounted() {
    console.log("mounted customModelsList")
  },
  methods: {
    transformType(model: CustomModel) {
      if (model.fineTuneType == "lora") return "normal"
      else return "advanced"
    },
    async toggleModelPrivacy(model: CustomModel) {
      try {
        await modelsSetModelPrivacy({ id: model.id, public: !model.Public })
        Notify.create(`${model.name} privacy updated to: ${!model.Public ? "Public" : "Private"}`)
        model.Public = !model.Public
      } catch (error) {
        catchErr(error)
      }
    },
    privacyIcon(model: CustomModel) {
      return model.Public ? "visibility" : "visibility_off"
    },
    async setModelName() {
      if (!this.editingModelNameId) return
      try {
        await modelsEditModel({ id: this.editingModelNameId, name: this.newModelName, description: this.newModelDescription || "" })
        this.showEditNameDialog = false
        Notify.create("Model name updated")
        await this.loadData()
      } catch (error) {
        catchErr(error)
      }
    },
    editModelName(model: CustomModel) {
      this.editingModelNameId = model.id
      this.newModelName = model.name
      this.newModelDescription = model.description
      this.showEditNameDialog = true
    },
    async loadData() {
      console.log("loadData")
      try {
        // show cached instantly
        const cached = this.forgeStore.state.userModels || []
        let list = cached
        if (this.trainedOnly) list = list.filter((m) => m.status === "trained")
        if (this.trainingSetId) list = list.filter((m) => m.trainingSetId === this.trainingSetId)
        this.models = list as any

        // refresh in background (stale-while-revalidate)
        await this.forgeStore.loadUserModels(true)
        const refreshed = this.forgeStore.state.userModels || []
        let list2 = refreshed
        if (this.trainedOnly) list2 = list2.filter((m) => m.status === "trained")
        if (this.trainingSetId) list2 = list2.filter((m) => m.trainingSetId === this.trainingSetId)
        this.models = list2 as any
      } catch (error) {
        catchErr(error)
        this.models = []
      }
    },
    handleModelClick(model: CustomModel) {
      // console.log(model)
      // this.$router.push({ name: "model", params: { modelId: model.id } })
      console.log("handleModelClick")
      this.$emit("modelClicked", model)
    },
    async deleteModel(model: CustomModel) {
      console.log(model)
      Dialog.create({
        title: "Delete Model: " + model.name,
        message: "Are you sure you want to delete this model?",
        ok: {
          label: "Yes",
          color: "negative",
        },
        cancel: {
          label: "No",
          color: "primary",
        },
      }).onOk(async () => {
        try {
          await modelsDeleteModel({ id: model.id })
          Notify.create(`${model.name} deleted`)
          await this.loadData()
        } catch (error) {
          catchErr(error)
        }
      })
    },
  },
})
</script>
