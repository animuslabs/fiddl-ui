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
      .row
        q-btn(icon="arrow_back" flat round @click="setRequest()" size="sm")
      .row
        q-btn(icon="link" flat round @click="goToRequestPage()" size="sm")
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
import { longIdToShort, timeSince, toObject } from "lib/util"
import { PropType } from "vue"
import { CreatedItem } from "lib/types"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import { img } from "lib/netlifyImg"
import imageGallery from "lib/imageGallery"
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
    goToRequestPage() {
      const shortId = longIdToShort(this.creation.id)
      void this.$router.push({ name: "imageRequest", params: { requestShortId: shortId } })
    },
    showGallery(startIndex: number) {
      const root = this.$root
      if (!root) return
      const images = this.creation.imageIds
      // root.openDialog(startIndex, images)
      // this.$root.openDialog(startIndex)
      imageGallery.show(images, startIndex)
    },
    setRequest() {
      const req = toObject(this.creation.request)
      req.seed = undefined
      console.log("set request", req)
      this.$emit("setRequest", req)
    },
  },
})
</script>
