<template lang="pug">
q-card.q-pa-md(style="position: relative; overflow: hidden;" @click.stop="console.log('hi')" :style="selectable ? 'cursor:pointer' : ''")
  .card-bg(:style="cardBgStyle" style="height:250px; position: absolute;")
  .row(style="position: relative; z-index: 1;")
    //- //- .col-auto(style="width:40px;")
    //- //-   q-btn(size="sm" icon="close" flat round )
    //- q-separator(vertical)
    .col.q-ml-md
      .row
        h4.text-bold {{ model.name }}
      .row.ellipsis-2-lines(style="height:50px;")
        p {{ model.description }}
      .row.q-mt-md
        q-chip(v-for="tag in model.modelTags" :key="tag" color="grey-9" text-color="white" clickable @click.stop="$emit('chipClick', tag)")
          small {{ tag }}
</template>

<script setup lang="ts">
import { type ModelTags } from "lib/imageModels"
import { img, s3Video } from "lib/netlifyImg"
import { type ModelsGetBaseModels200Item } from "lib/orval"
import { reactive, computed } from "vue"

const props = defineProps({
  model: {
    type: Object as () => ModelsGetBaseModels200Item,
    required: true,
  },
  selectable: { type: Boolean, default: false },
})
defineEmits({
  chipClick: (tag: ModelTags) => true,
})

const cardBgStyle = computed(() => {
  const { modelTags, previewMediaId } = props.model
  let mediaUrl = modelTags.includes("Video") ? s3Video(previewMediaId || "", "thumbnail") : img(previewMediaId || "", "md")
  return {
    "background-image": `linear-gradient(to left, rgba(0,0,0,.3), rgba(30,30,30,1)), url('${mediaUrl}')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    // position: "absolute",
    inset: "0",
    zIndex: 0,
  }
})
</script>

<style scoped>
.card-bg {
  pointer-events: none;
}
</style>
