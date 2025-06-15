<template lang="pug">
div.q-mt-md
  .centered
    h5 Forge Models
  .centered.q-mt-md
    q-btn(
      label="Create Forge Model"
      @click="$emit('createModel')"
      size="lg"
      icon="add"
      color="primary"
    )
  .centered.q-ma-md
    CustomModelsList(@modelClicked="handleModelClicked")

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
