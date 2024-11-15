<template lang="pug">
  QList(v-if="models?.length")
    QItem(v-for="model in models" :key="model.id")
      .row.q-gutter-md.items-center
        div
          q-btn(icon="delete" flat color="red" @click="deleteModel(model)")
        div.cursor-pointer(@click="handleModelClick(model)")
          QItemLabel
            h4 {{ model.name }}
          QItemLabel
            p {{ model.status }}
          QItemLabel
            p {{ model.createdAt }}
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

export default defineComponent({
  components: {},
  emits: {
    modelClicked: (model: CustomModel) => true,
  },
  data: function () {
    return {
      models: [] as CustomModel[] | null,
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
