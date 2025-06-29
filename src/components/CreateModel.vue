<template lang="pug">
div.q-mt-md
  div(v-if="notEnoughPoints").full-width
    .centered
      h5 You don't Have enough Fiddl Points to proceed
    .centered.q-ma-md
      q-btn(
        label="Get more points"
        @click="$router.push({name:'addPoints'})"
        flat
        color="accent"
        size="lg"
      )
  .centered
    div.q-ma-lg(style="max-width:800px")
      p Upload 15-30 images of a subject or style.
      p The more images you add, the more precise and consistent your custom model becomes.
  .centered.q-mt-md.q-gutter-md.q-ma-md
    div
      p Pick a name for this forge model
      q-input( v-model="modelName" outlined)
    div
      p Training Mode
      q-select(
        v-model="trainingMode"
        :options="trainingModes"
        outlined
        style="text-transform: capitalize"
      )
  .centered
    h4 Cost: {{ pricingMap[trainingMode]?.toLocaleString() }} Fiddl Points
  .centered.q-ma-md(v-if="!notEnoughPoints")
    UploaderCard(@formData="handleFormData")
</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"
const trainingModes = ["normal", "advanced"] as const
type FaceForgeMode = (typeof trainingModes)[number]
export const pricingMap: Record<FaceForgeMode, number> = {
  normal: 600,
  advanced: 900,
}

export default defineComponent({
  components: {
    UploaderCard,
  },
  emits: {
    startTraining: (data: { modelName: string; trainingMode: FaceForgeMode; formData: FormData }) => true,
  },
  data() {
    return {
      modelName: "",
      trainingMode: "normal" as FaceForgeMode,
      pricingMap,
      trainingModes,
    }
  },
  computed: {
    notEnoughPoints() {
      return this.cost > (this.$userAuth.userData?.availablePoints || 0)
    },
    cost() {
      return this.pricingMap[this.trainingMode] || 0
    },
  },
  methods: {
    handleFormData(formData: any) {
      this.$emit("startTraining", {
        modelName: this.modelName,
        trainingMode: this.trainingMode,
        formData,
      })
    },
  },
})
</script>
