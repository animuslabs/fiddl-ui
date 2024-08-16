<template lang="pug">
div
  .centered
    h5 Enter a question about this transcript.
  q-form(
    @submit="submitPrompt"
  )
    q-input.q-mt-md(
      v-model="prompt"
      rows="3"
      max-height="100px"
      type="text"
      outlined
      style="width:90vw; max-width:800px;"
      input-style="font-size:1.5em;"
    )
    .centered.full-width
      q-btn.full-width(
        flat
        color="primary"
        label="Submit"
        type="submit"
      )
  .centered.q-mt-md
    q-card.bg-white.q-pa-md(style="width:90vw; max-width:700px; min-height:100px;")
      .centered.q-mt-md(v-if="loading").relative-position
        q-spinner(size="100px")
      h5
        q-img.float-left(src="/reicaller.svg" height="50px" width="50px").q-mr-md.q-mt-md
        | {{response}}


</template>

<script lang="ts">
import { PropType, defineComponent } from "vue"
import { api } from "src/lib/api"

export default defineComponent({
  data() {
    return {
      prompt: "",
      response: "",
      oldResponses: [],
      loading: false
    }
  },
  props: {
    id: {
      type: String,
      required: true
    }
  },
  methods: {
    async submitPrompt() {
      this.loading = true
      this.response = ""
      const response = await api.getPromptResponse(this.id, this.prompt).catch(alert)
      this.response = response
      this.loading = false
    }
  }
})
</script>
