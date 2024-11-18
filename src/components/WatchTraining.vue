<template lang="pug">
div.q-mt-md
  .centered
    .q-ma-md
      h5 Training in progress
      p This will take 10 - 20 minutes
      p This page will automatically update when training is complete
  div(v-if="trainingData")
    .centered
      div(style="max-width:800px").q-ma-md
        div.q-ma-md(v-if="trainingData.logs")
          h4 Status:
          .full-width(style="height: 200px; overflow-y: auto")
            p {{ trainingData.status }}
            pre {{ trainingProgress }}
  .centered.q-ma-md
    q-btn(
      label="Back"
      @click="$emit('back')"
      flat
      color="primary"
      size="lg"
    )
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { TrainingData } from "lib/api"
import { parseTrainingLog } from "lib/modelTraining"
export default defineComponent({
  props: {
    trainingData: { required: false, type: Object as PropType<TrainingData>, default: null },
  },
  computed: {
    trainingProgress() {
      if (!this.trainingData?.logs) return null
      return parseTrainingLog(this.trainingData.logs)
    },
  },
})
</script>
