<template lang="pug">
q-img(:src="imageUrl" style="border-radius: 14px;")

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
    loadImage() {
      this.imageUrl = img(this.imageId, this.size)
    },
  },
})
</script>
