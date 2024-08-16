<template lang="pug">
div
  .centered.items-center
    q-card.q-ma-md.bg-white.q-pa-md.full-width
      h4 Short Summary
      q-separator(spaced)
      .q-pa-md
        p {{ fileData.shortSummary }}
    q-card.q-ma-md.bg-white.q-pa-md.full-width
      h4 Detailed Summary
      q-separator(spaced)
      .q-pa-md
        p {{ fileData.longSummary }}
    q-card.q-ma-md.bg-white.q-pa-md.full-width
      h4 Key Details
      q-separator(spaced)
      div.full-width(v-for="dataPoint of fileData.keyDataPoints" :key="dataPoint.type" style="width:100vw")
        h5.text-capitalize {{ dataPoint.type }}
        .q-pa-md
          div(v-for="detail of Object.entries(dataPoint)")
            div(v-if="detail[0] != 'type'")
              strong {{ detail[0] }}
              div {{ detail[1] }}
        //- q-item
        //-   q-item-section
        //-     q-item-label {{ dataPoint.type }}
        //-   q-item-section
        //-     q-item-label {{ dataPoint }}
      //- .q-pa-md
      //-   pre {{ fileData.keyDataPoints }}
</template>

<script lang="ts">
import { PropType, defineComponent } from "vue"

export default defineComponent({
  props: {
    fileData: {
      type: Object,
      required: true
    }
  }
})
</script>
