<template lang="pug">
div.q-mt-md
  .centered
    h5 Face Forge Models
  .centered.q-mt-md
    q-btn(
      label="Create Face Forge"
      @click="$emit('createModel')"
      flat
      icon="add"
      color="primary"
    )
  .centered.q-ma-md
    CustomModelsList(style="width:600px; max-width:90vw;" @modelClicked="handleModelClicked")
  .centered.q-mb-xl
    q-btn(
      label="Create Face Forge"
      @click="$emit('createModel')"
      flat
      icon="add"
      color="primary"
    )

</template>

<script lang="ts">
import { defineComponent } from "vue"
import CustomModelsList from "./CustomModelsList.vue"
import { CustomModel } from "lib/api"

export default defineComponent({
  components: {
    CustomModelsList,
  },
  emits: {
    createModel: null,
    selectModel: (model: CustomModel) => true,
  },
  methods: {
    handleModelClicked(model: CustomModel) {
      this.$emit("selectModel", model)
    },
  },
})
</script>
