<template lang="pug">
q-card(style="overflow:auto").q-mb-md.q-pr-md.q-pl-md.q-pb-lg
  .row.full-width.q-pt-md.q-pb-md
    div(v-if="creation.imageIds.length < 1").full-width
      .centered.q-ma-xl
        h4.text-accent Error during Image generation
    .col( v-for="(imageId,index) in creation.imageIds" :key="imageId" style="max-width:300px; min-width:200px;").gt-sm.q-pa-sm
      CreatedImageCard.cursor-pointer( :imageId="imageId" @click="showGallery(index)" )
    .col( v-for="(imageId,index) in creation.imageIds" :key="imageId" style="max-width:300px; min-width:100px; ").lt-md.q-pa-sm
      CreatedImageCard.cursor-pointer( :imageId="imageId" @click="showGallery(index)" )
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

</template>

<script lang="ts">
import { defineComponent } from "vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { timeSince } from "lib/util"
import { PropType } from "vue"
import { CreatedItem } from "lib/types"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import { img } from "lib/netlifyImg"
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
    }
  },
  methods: {
    showGallery(startIndex: number) {
      const root = this.$root
      if (!root) return
      const images = this.creation.imageIds.map((el: any) => img(el, "lg"))
      //@ts-expect-error root is not null
      root.openDialog(startIndex, images)
      // this.$root.openDialog(startIndex)
    },
    setRequest() {
      this.$emit("setRequest", this.creation.request)
    },
  },
})
</script>
