<template lang="pug">
div.q-mt-md
  .centered
    h5 Face Forge Models
  .centered.q-ma-md
    CustomModelsList(style="width:600px; max-width:90vw;" @modelClicked="handleModelClicked")
  .centered
    q-btn(
      label="Create Face Forge"
      @click="$emit('createModel')"
      flat
      color="primary"
      size="lg"
    )
</template>

<script lang="ts">
import { defineComponent } from "vue"
import CustomModelsList from "./CustomModelsList.vue"

export default defineComponent({
  components: {
    CustomModelsList,
  },
  emits: {
    createModel: null,
    selectModel: (model: any) => true,
  },
  methods: {
    handleModelClicked(model: any) {
      this.$emit("selectModel", model)
    },
  },
})
</script>
