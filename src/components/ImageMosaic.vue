<template lang="pug">
.container
  div(v-for="item in items" :key="item.id" :class="item.cssClass")
    CreatedImageCard.cursor-pointer.container-image(:imageId="getRandImg(item.imageIds)" :size="item.cssClass == 'small'?'sm':'md'" @click="showGallery($event,item)")
    .absolute-bottom
      .centered
        div(v-for="img in item.imageIds.length").q-mb-xs
          div(style="width:4px;height:4px; margin:2px; border-radius:50%; outline: .5px solid black;").bg-grey-6
</template>

<script lang="ts">
import { img } from "lib/netlifyImg"
import { extractImageId, pickRand } from "lib/util"
import { BrowserItem } from "src/stores/browserStore"
import { PropType } from "vue"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import ImageGallery from "./dialogs/ImageGallery.vue"
import { Dialog } from "quasar"
import imageGallery from "lib/imageGallery"

export default {
  name: "ImageMosaic",
  components: {
    CreatedImageCard,
  },
  props: {
    items: {
      type: Array as PropType<BrowserItem[]>,
      required: true,
    },
  },
  data() {
    return {
      img,
    }
  },
  computed: {},
  methods: {
    getRandImg(imageIds: string[]) {
      return pickRand(imageIds) as string
    },
    showGallery(val: PointerEvent, item: BrowserItem) {
      const target = val.target as HTMLImageElement
      const id = extractImageId(target.src)
      if (!id) return
      const index = (id: string) => item.imageIds.findIndex((el) => el === id)
      imageGallery.show(item.imageIds, index(id), item.id)
    },
  },
}
</script>

<style scoped>
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  grid-auto-rows: 100px;
  gap: 16px;
  grid-auto-flow: dense;
  /* background-color: red; */
}
@media (max-width: 600px) {
  .container {
    grid-template-columns: repeat(2, 1fr);
  }
}

.container > div {
  position: relative;
  overflow: hidden;
  justify-content: center;
  align-items: center;
  min-width: 50px;
}

.container-image {
  width: 100%;
  height: 100%;
  object-fit: cover !important;
}

/* Create classes for varying grid item sizes */
.small {
  grid-column: span 1;
  grid-row: span 1;
}

.medium {
  grid-column: span 2;
  grid-row: span 2;
}

.large {
  grid-column: span 3;
  grid-row: span 3;
}

.wide {
  grid-column: span 2;
  grid-row: span 1;
}
.wide-lg {
  grid-column: span 4;
  grid-row: span 2;
}

.tall {
  grid-column: span 1;
  grid-row: span 2;
}
.tall-lg {
  grid-column: span 2;
  grid-row: span 4;
}

.extraWide {
  grid-column: span 6;
  grid-row: span 3;
}

.extraTall {
  grid-column: span 2;
  grid-row: span 4;
}
.square {
  grid-column: span 1;
  grid-row: span 1;
}
</style>
