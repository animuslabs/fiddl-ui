<!-- CreationCard.vue -->
<template lang="pug">
q-card(style="overflow:scroll" ).q-mb-md.q-pr-md.q-pl-md.q-pb-lg
  .row.full-width.q-pt-md.q-pb-md
    div(v-if="creation.imageIds.length < 1").full-width
      .centered.q-ma-xl
        h4.text-accent Error during Image generation
    .col-auto(v-else v-for="(imageId,index) in creation.imageIds" :key="imageId" style="width:400px;" )
      CreatedImageCard( :imageId="imageId" @click="showGallery(index)").full-width.q-pa-md
  q-separator(color="grey-9" spaced="20px")
  .row.q-gutter-md.no-wrap(style="padding-left:20px; padding-right:20px;")
    .col-auto
      q-btn(icon="arrow_back" flat round @click="setRequest()")
    .col(style="min-width:220px;")
      small Prompt: #[p.ellipsis-2-lines {{ creation.request.prompt }}]
    .col-grow.gt-sm
    .col-auto.gt-sm
      .row.q-gutter-md.no-wrap
        .col-auto
          small Created: #[p {{ timeSince(creation.createdAt) }}]
          q-tooltip
            p {{ creation.createdAt.toString() }}
        .col-auto
          small Model: #[p {{ creation.request.model }}]
        .col-auto
          small Aspect Ratio: #[p {{ creation.request.aspectRatio }}]
        .col-auto
          small Quantity: #[p {{ creation.request.quantity }}]
        .col-auto
          small Private: #[p {{ !creation.request.public }}]
  //- ImageGallery(:images="creation.imageIds.map(el => img(el,'lg'))" ref="gallery")
  //- ImageGallery(:images="images" ref="gallery")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { timeSince } from "lib/util"
import { PropType } from "vue"
import { CreatedItem } from "src/stores/createSessionStore"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import { img } from "lib/netlifyImg"
const images = ["https://cdn.quasar.dev/img/mountains.jpg", "http://localhost:4444/images/82c1f0a4-11f9-4ed9-bd5d-2eeadf72c313-lg.webp"]
export default defineComponent({
  components: {
    CreatedImageCard,
    ImageGallery,
  },
  props: {
    creation: {
      type: Object as PropType<CreatedItem>,
      required: true,
    },
  },
  emits: ["setRequest"],
  data() {
    return {
      timeSince,
      img,
      images,
    }
  },
  methods: {
    showGallery(startIndex: number) {
      // const gallery = this.$refs.gallery as InstanceType<typeof ImageGallery>
      // gallery.openDialog(startIndex)
    },
    setRequest() {
      this.$emit("setRequest", this.creation.request)
    },
  },
})
</script>
