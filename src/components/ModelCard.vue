<template lang="pug">
q-card.q-pa-md(
  style="position: relative; overflow: hidden;"
  @click.stop="console.log('hi')"
  :class="{ 'cursor-pointer': selectable }"
).relative-position
  .card-bg(style="height:250px; position: absolute; inset: 0;")
    .card-bg-img(:style="cardBgImgStyle")
    .card-bg-gradient(:style="cardBgGradientStyle")
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
    div.q-pa-md(style="right:-20px; bottom:-20px; position: absolute;")
      q-icon(:name="isVideo?'smart_display':'image'" size="35px"  :style="iconStyle")
</template>

<script setup lang="ts">
import { type ModelTags } from "lib/imageModels"
import { img, s3Video } from "lib/netlifyImg"
import { type ModelsGetBaseModels200Item } from "lib/orval"
import { reactive, computed } from "vue"

// --- Ensure these are top-level so template can access them ---
const cardBgImgStyle = computed(() => {
  const { modelTags, previewMediaId } = props.model
  let mediaUrl = modelTags.includes("Video") ? s3Video(previewMediaId || "", "thumbnail") : img(previewMediaId || "", "md")
  const style: Record<string, string> = {
    backgroundImage: `url('${mediaUrl}')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    position: "absolute",
    inset: "0",
    zIndex: "0",
    transition: "filter 0.2s",
  }
  style.filter = "grayscale(40%)"

  return style
})

const cardBgGradientStyle = computed(() => {
  const style: Record<string, string> = {
    background: `linear-gradient(
      to top left,
      ${isVideo.value ? "var(--q-positive)" : "var(--q-primary)"} 3%,
      rgba(30,30,30,.4),
      rgba(30,30,30,.6),
      rgba(30,30,30,.7),
      rgba(30,30,30,.9)
    )`,
    position: "absolute",
    inset: "0",
    zIndex: "1",
    pointerEvents: "none",
  }
  return style
})
// -------------------------------------------------------------

const props = defineProps({
  model: {
    type: Object as () => ModelsGetBaseModels200Item,
    required: true,
  },
  selectable: { type: Boolean, default: false },
  grayscale: { type: Boolean, default: false },
})
defineEmits({
  chipClick: (tag: ModelTags) => true,
})
const isVideo = computed(() => props.model.modelTags.includes("Video"))
const iconStyle = computed(() => ({ color: isVideo.value ? "--q-positive" : "--q-primary", opacity: 0.9 }))
</script>

<style scoped>
.card-bg {
  pointer-events: none;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.card-bg-img {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  z-index: 0;
  transition: filter 0.2s;
}
.card-bg-gradient {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
</style>
