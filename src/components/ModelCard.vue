<template lang="pug">
q-card.q-pa-md(
  style="position: relative; overflow: hidden;"
  @click.stop="console.log('hi')"
  :style="mergedCardStyle"
).relative-position
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
        q-chip(v-for="tag in model.modelTags" :key="tag" text-color="white" clickable @click.stop="$emit('chipClick', tag)")
          small {{ tag }}
    div.q-pa-md(style="right:0px; bottom:-20px; position: absolute;")
      q-icon(:name="isVideo?'smart_display':'image'" size="35px"  :style="{ color: 'white', opacity: 0.5 }")
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

const isVideo = computed(() => props.model.modelTags.includes("Video"))

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

const mergedCardStyle = computed(() => {
  const base: any = cardBorder.value
  if (props.selectable) {
    base.cursor = "pointer"
  }
  return base
})

const cardBorder = computed(() => {
  const { modelTags } = props.model
  const isVideo = modelTags.includes("Video")
  // Use Quasar theme CSS vars
  const color = isVideo ? "var($q-indigo)" : "var(--q-primary, #00adc7)"
  // More visible, layered shadow for dark backgrounds
  return {
    // border: `0.5px solid ${color}`,
    // boxShadow: `0 10px 20px ${color}`,
    // shadow: `0 10px 20px ${color}`,
    // borderRadius: "8px",
    // backgroundColor: "rgba(0, 0, 0, 0.5)",
    // color: "white",
  }
})
</script>

<style scoped>
.card-bg {
  pointer-events: none;
}
</style>
