<template lang="pug">
div
  q-card
    div
      .row.no-wrap
        .col
          q-img.rounded-borders.cursor-pointer(@click="toggleFullscreen" :src="imageUrl" style="border-radius: 14px; width:100%; height:100%;")
        //- .col-auto.q-ml-md.q-mr-md.q-mt-md
        //-   .column.items-center.justify-center.q-gutter-md
        //-     q-btn(icon="favorite" color="grey-10")
        //-     q-btn(icon="keyboard_double_arrow_up"  :flat="createdImage.points <= 0" :color="upColor" @click="createdImage.points = 1")
        //-     q-btn(icon="radio_button_unchecked" color="brown" :flat="createdImage.points != 0" round  @click="createdImage.points = 0")
        //-     q-btn(icon="keyboard_double_arrow_down" :color="downColor" :flat="createdImage.points >= 0"  @click="createdImage.points = -1")
//- q-dialog(v-model="fullscreen"  ).full-width
//-   div
//-     q-img(:src="imageBlobUrl" style="width:100vw; height:auto; max-width:100vw; max-height:100vh; ")
//-     q-card-actions
//-       q-btn(label="Close" color="primary" @click="fullscreen = false")


</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { CreatedItem } from "stores/createSessionStore"
import type { ImageSize } from "fiddl-server/dist/lib/types/serverTypes"
import { img } from "lib/netlifyImg"

export default defineComponent({
  components: {},
  props: {
    imageId: {
      type: String,
      required: true,
    },
    size: {
      type: String as PropType<ImageSize>,
      required: false,
      default: "md",
    },
  },
  emits: [],
  data() {
    return {
      imageUrl: "" as string,
      internalSize: this.size as ImageSize,
      fullscreen: false as boolean,
    }
  },
  computed: {
    // upColor(): string {
    //   return this.createdImage.points === 1 ? "primary" : "primary"
    // },
    // downColor(): string {
    //   return this.createdImage.points === -1 ? "secondary" : "secondary"
    // },
  },
  watch: {
    size(newSize) {
      this.internalSize = newSize // Watch for changes in the prop and update the internal state
      void this.loadImage()
    },
    createdImage: {
      immediate: true,
      handler() {
        void this.loadImage()
      },
    },
  },
  mounted() {},
  methods: {
    toggleFullscreen() {
      this.internalSize = this.fullscreen ? "md" : "lg"
      this.fullscreen = !this.fullscreen
    },
    async loadImage() {
      // this.imageBlobUrl = await api.image.load(this.createdImage.id, this.internalSize)
      // this.imageBlobUrl = `${apiUrl}/images/${this.createdImage.id}-${this.internalSize}.webp`
      this.imageUrl = img(this.imageId, "lg")
    },
  },
})
</script>
