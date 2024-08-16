<template lang="pug">
div.bg-white
  div(v-for="chunk in transcriptionChunks").q-ma-md
    h6.text-weight-bold {{ chunk.speaker }}
    p {{ chunk.text }}
</template>

<script lang="ts">
import { PropType, defineComponent } from "vue"
import { TranscriptionChunk } from "src/lib/transcriptionUtil"

export default defineComponent({
  props: {
    transcriptionChunks: {
      type: Array as PropType<TranscriptionChunk[]>,
      required: true
    }
  }
})
</script>
