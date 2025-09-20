<template lang="pug">
div.q-mt-md
  .centered
    .q-ma-md
      h6 Training Model:
      h2 {{ modelData.name }}
      .centered(v-if="!trainingData?.error")
        .q-pa-md.relative-position(style="height:110px; width:110px; border-radius: 100%;")
          q-spinner-grid.absolute-center(size="80px" color="primary" )
          q-spinner-cube.absolute-center(size="80px" color="primary" )
      div.q-mt-lg
        p This will take 5 - 45 minutes
        p This page will automatically update when training is complete.
        p You can safely navigate to another page and check back later.
    div(v-if="trainingData" style="width:800px; max-width:90vw")
      .centered
        div(style="max-width:800px").q-ma-md.full-width
          div.q-ma-md(v-if="trainingData.error")
            h6.text-accent Error:
            p {{ trainingData.error }}
          div(v-if="!trainingData.error")
            h6 Status:
            .full-width(style="height: 200px; overflow-y: auto")
              h3(v-if="(trainingData.progress||0)>0")
                q-spinner.q-mr-md(color="primary")
                | {{ trainingData.status }}
              h3(v-else)
                q-spinner.q-mr-md
                | Training...
              div(v-if="modelData.modelType != 'fluxDev'")
                p Progress data not available for this base model, custom model will be available on the forge page when ready.
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
  q-dialog(v-model="showErrorDialog")
    q-card
      .q-ma-md
        h5.q-mb-sm Model Training Error
        p.q-mb-md {{ errorMessage || 'An unknown training error occurred.' }}
        p.text-body2.text-grey
          | An automatic points refund was issued due to a training error. You can try training again, or you may need to create a different training set.
        .row.q-gutter-md.q-mt-md
          q-btn(label="Close" @click="onErrorDialogClose" color="primary" flat)
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
  data() {
    return {
      showErrorDialog: false,
      errorMessage: "" as string,
      errorHandled: false,
    }
  },
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
        } else if ((val?.status === "failed" || val?.error) && !this.errorHandled) {
          this.errorMessage = val?.error || "An unknown training error occurred."
          this.showErrorDialog = true
          this.errorHandled = true
        }
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    onErrorDialogClose() {
      this.showErrorDialog = false
      this.$emit("back")
    },
  },
})
</script>
