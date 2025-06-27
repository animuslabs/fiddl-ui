<template lang="pug">
div.q-mt-md
  .centered.full-width
    div.q-pa-md.q-ma-md(style="max-width:800px")
      p Upload 15-30 images of a subject or style.
      p Adding more high quality images will generally improve the quality of models trained on this set.
  .centered.q-ma-md(v-if="!notEnoughPoints")
    UploaderCard(@filesReady="handleFiles")
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
  .centered.q-mt-md.q-gutter-md.q-ma-md
    div
      p.q-mb-sm Pick a name for this training set
      q-input( v-model="setName" outlined)
    div
      p.q-mb-sm Describe the subject or style of this training set
      q-input( v-model="setDescription" outlined type="textarea" rows="3" autogrow
        placeholder="e.g. 'A portrait of John Doe' or 'a painting style using bright colors'")
      p This description is used during training to help models understand the content.
  .centered
    h4 Cost: {{ price.toLocaleString() }} Fiddl Points
</template>

<script lang="ts">
import { defineComponent } from "vue"
import UploaderCard from "./UploaderCard.vue"

export default defineComponent({
  components: {
    UploaderCard,
  },
  emits: {},
  data() {
    return {
      setName: "" as string | null | number,
      setDescription: "" as string | null | number,
      price: 10,
    }
  },
  computed: {
    notEnoughPoints() {
      return this.price > (this.$userAuth.userData?.availablePoints || 0)
    },
  },
  methods: {
    handleFiles(files: File[]) {
      console.log("Files received:", files)
    },
  },
})
</script>
