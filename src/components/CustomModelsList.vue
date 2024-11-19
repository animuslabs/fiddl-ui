<template lang="pug">
  QList(v-if="models?.length").full-width
    QItem(v-for="model in models" :key="model.id")
      .row.q-gutter-md.items-center
        div
          q-btn(icon="delete" flat color="red" @click="deleteModel(model)")
        div.cursor-pointer(@click="handleModelClick(model)")
          .q-ml-md(style="text-transform: capitalize;")
            h3 {{ model.name }}
          .row.q-gutter-md.full-width
            .col-auto(style="width:100px;")
              QItemLabel
                p Status
                h4 {{ model.status }}
            .col-auto(style="width:200px;")
              QItemLabel
                p Created
                h5 {{ timeSince(new Date(model.createdAt)) }}
            .col
              QItemLabel
                p Preset
                h4(style="text-transform:capitalize") {{ model.trainingPreset }}
            .col-auto(v-if="model.imageRequests.length")
              .row.q-ml-lg
                div(v-for="imageRequest in model.imageRequests" :key="imageRequest.id")
                  .relative-position(style="width:60px; height:50px;")
                    img(:src="img((imageRequest.images[0]?.id||''),'sm')" style="max-width:100px; max-height:100px; object-fit:contain; margin:5px; border-radius:25px; position:absolute; bottom:-30px; box-shadow: 0px 1px 15px rgba(1,1,1,.1) !important")
        .full-width
          q-separator(color="grey" spaced="20px")
  div(v-else)
    .full-width(style="height: '100px'")
      .centered
        h6 No custom models, create one to get started

</template>
<script lang="ts">
import { CustomModel } from "lib/api"
import { catchErr } from "lib/util"
import { Dialog, Notify } from "quasar"
import { defineComponent } from "vue"
import { timeSince } from "lib/util"
import { img } from "lib/netlifyImg"

export default defineComponent({
  components: {},
  emits: {
    modelClicked: (model: CustomModel) => true,
  },
  data: function () {
    return {
      models: [] as CustomModel[] | null,
      timeSince,
      img,
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      async handler(val) {
        if (!val) return (this.models = [])
        await this.loadData()
      },
      immediate: true,
    },
  },
  mounted() {
    console.log("mounted")
  },
  methods: {
    async loadData() {
      console.log("loadData")
      this.models = (await this.$api.models.getUserModels.query().catch(catchErr)) || null
    },
    handleModelClick(model: CustomModel) {
      // console.log(model)
      // this.$router.push({ name: "model", params: { modelId: model.id } })
      console.log("handleModelClick")
      this.$emit("modelClicked", model)
    },
    deleteModel(model: CustomModel) {
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
        await this.$api.models.deleteModel.mutate(model.id).catch(catchErr)
        Notify.create("Model deleted")
        await this.loadData()
      })
    },
  },
})
</script>
