<template lang="pug">
div.q-mt-md
  .centered
    .q-ma-md
      h6 Training Model:
      h2 {{ modelData.name }}
      .centered
        .q-pa-md.relative-position(style="height:110px; width:110px; border-radius: 100%;")
          q-spinner-grid.absolute-center(size="80px" color="primary" )
          q-spinner-cube.absolute-center(size="80px" color="primary" )
      div.q-mt-lg
        p This will take 15 - 30 minutes
        p This page will automatically update when training is complete
    div(v-if="trainingData" style="width:800px; max-width:90vw")
      .centered
        div(style="max-width:800px").q-ma-md.full-width
          div.q-ma-md(v-if="trainingData.error")
            h6.text-accent Error:
            p {{ trainingData.error }}
          div
            h6 Status:
            .full-width(style="height: 200px; overflow-y: auto")
              h3(v-if="(trainingData.progress||0)>0")
                q-spinner.q-mr-md(color="primary")
                | {{ trainingData.status }}
              h3(v-else)
                q-spinner.q-mr-md
                | Initializing...
              div(v-if="trainingProgress").q-mt-md
                h4 {{ trainingProgress }}%
                q-linear-progress(:value="trainingData.progress /100" stripe size="20px" track-color="grey" )
                .row.q-gutter-md
                  div
                    h6 Elapsed:
                    h4 {{ trainingData.elapsedTime }}
                  .col-grow
                  div
                    h6 Remaining:
                    h4 {{ trainingData.remainingTime }}
            //- div
            //-   pre(style="height:900px;") {{trainingData}}
  .centered.q-ma-md
    q-btn( label="Back" @click="$emit('back')" flat color="primary" size="lg" )
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { CustomModel, TrainingData } from "lib/api"
import { parseTrainingLog } from "lib/modelTraining"
import { Dialog } from "quasar"
export default defineComponent({
  props: {
    trainingData: { required: false, type: Object as PropType<TrainingData>, default: null },
    modelData: { required: true, type: Object as PropType<CustomModel> },
  },
  emits: ["back", "finished"],
  computed: {
    trainingProgress() {
      if (!this.trainingData) return null
      return this.trainingData.progress
    },
  },
  watch: {
    trainingData: {
      handler(val) {
        if (val?.status === "succeeded") {
          Dialog.create({
            title: "Training Complete",
            message: "Your model is ready to use",
            ok: true,
          }).onOk(() => this.$emit("finished"))
          // void this.$emit("finished")
        }
      },
      immediate: true,
      deep: true,
    },
  },
})
</script>
