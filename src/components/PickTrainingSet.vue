<template lang="pug">
  div.q-mt-md
    .centered
      h3 My Training Sets
    .centered
      p Groups of images used for training models
    .centered.q-mt-md
      q-btn(
        label="Add Training Set"
        @click="$emit('createSet')"
        size="lg"
        icon="add"
        color="primary"
        outline
        rounded
      )
    .centered.q-ma-md
      TrainingSetList(@setClicked="$emit('selectSet', $event)")

  </template>

<script lang="ts">
import { defineComponent } from "vue"
import { TrainingSet } from "lib/api"
import TrainingSetList from "./TrainingSetList.vue"

export default defineComponent({
  components: {
    TrainingSetList,
  },
  emits: {
    createSet: null,
    selectSet: (set: TrainingSet) => true,
  },
})
</script>
