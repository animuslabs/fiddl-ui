<template lang="pug">
  .container
    div(v-for="item in items" :key="item.id" :class="item.cssClass")
      CreatedImageCard.cursor-pointer(:imageId="getRandImg(item.imageIds)" :size="item.cssClass == 'small'?'sm':'md'" @click="showGallery($event,item)")
      //- div {{ item.cssClass }}
</template>

<script lang="ts">
import { img } from "lib/netlifyImg"
import { extractImageId, pickRand } from "lib/util"
import { BrowserItem } from "src/stores/browserStore"
import { PropType } from "vue"
import CreatedImageCard from "src/components/CreatedImageCard.vue"

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
  computed: {
    images(): string[] {
      return this.items.map((id) => img(id.imageIds[0] as string, "md") || "")
    },
  },
  methods: {
    getRandImg(imageIds: string[]) {
      return pickRand(imageIds) as string
    },
    showGallery(val: PointerEvent, item: BrowserItem) {
      const target = val.target as HTMLImageElement
      const id = extractImageId(target.src)
      if (!id) return
      const index = (id: string) => item.imageIds.findIndex((el) => el === id)
      const images = item.imageIds.map((el) => img(el, "lg"))
      // @ts-expect-error root is not null
      this.$root.openDialog(index(id), images)
    },
  },
}
</script>

<style scoped>
.container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  grid-auto-rows: 100px;
  gap: 20px;
  grid-auto-flow: dense;
}

.container > div {
  position: relative;
  overflow: hidden;
  /* display: flex; */
  justify-content: center;
  align-items: center;
}
.container >>> div {
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
