<template lang="pug">
div(v-if="customModel")
  PromptTab(:customModel="customModel" :id="0")
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import PromptTab from "./PromptTab.vue"
import { CustomModel } from "lib/api"

export default defineComponent({
  components: {
    PromptTab,
  },
  props: {
    customModel: {
      type: Object as PropType<CustomModel> | null,
      required: false,
    },
  },
})
</script>
