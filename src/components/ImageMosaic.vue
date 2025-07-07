<template lang="pug">
div(:class="containerClass")
  div(
    v-for="item in computedItems"
    :key="item.id"
    :class="getItemClass(item)"
  )
    div.relative-position
    CreatedImageCard.cursor-pointer.container-image(
      :imageId="getRandImg(item.imageIds)"
      :creatorId="item.creatorId"
      :size="getImageSize(item)"
      @click="showGallery($event, item)"
    )
    .absolute-bottom
      .row.items-center.q-ml-md(v-if="item.collections" style=" width:fit-content; border-radius: 24px; backdrop-filter: blur(3px); background-color: rgba(0, 0, 0, 0.4)")
        .col-auto.q-mr-sm.q-ml-sm
          p.text-white(v-if="item.collections") {{ item.collections }}
        .col-auto.q-mr-sm
          q-icon(name="favorite" size="15px" color="white")
      .centered
        div(v-for="img in item.imageIds.length").q-mb-xs
          div(style="width:4px;height:4px; margin:2px; border-radius:50%; outline: .5px solid black;").bg-grey-6
</template>

<script lang="ts">
import { userGetUsername } from "lib/orval"
import { avatarImg, img } from "lib/netlifyImg"
import { extractImageId, pickRand } from "lib/util"
import { BrowserItem } from "src/stores/browserStore"
import { PropType } from "vue"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
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
    gridMode: {
      type: Boolean,
      default: false,
    },
    imageSize: {
      type: String as PropType<"small" | "medium" | "large" | null>,
      default: null,
    },
  },
  data() {
    return {
      img,
      avatarImg,
    }
  },
  computed: {
    containerClass() {
      return this.imageSize ? "row q-gutter-md justify-center" : "container"
      // return "container"
    },
    computedItems() {
      return this.items.map((item) => {
        let cssClass = item.cssClass
        if (this.imageSize) {
          cssClass = this.imageSize
        }
        return {
          ...item,
          cssClass,
        }
      })
    },
  },
  methods: {
    getItemClass(item: BrowserItem) {
      if (this.imageSize) {
        if (this.imageSize === "small") {
          return "col-3" // Adjust for 3 columns
        }
        return "col-6 col-sm-2 col-md-2" // Default for grid mode
      } else {
        // console.log("gridmode not enabled", item.cssClass)
        return item.cssClass
      }
    },

    getImageSize(item: BrowserItem) {
      if (this.imageSize) return "md"
      // return this.imageSize === "small" ? "sm" : this.imageSize === "medium" ? "md" : "lg"
      else {
        return item.cssClass === "small" ? "sm" : "md"
      }
    },
    getRandImg(imageIds: string[]) {
      return pickRand(imageIds) as string
    },
    async showGallery(val: PointerEvent, item: BrowserItem) {
      const target = val.target as HTMLImageElement
      const id = extractImageId(target.src)
      if (!id) return
      const index = item.imageIds.findIndex((el) => el === id)
      let creatorName = ""
      try {
        const response = await userGetUsername({ userId: item.creatorId })
        creatorName = response.data || ""
      } catch (error) {
        console.error(error)
      }
      const creatorMeta = { id: item.creatorId, username: creatorName }
      console.log("creatorMeta", creatorMeta)
      console.log("reqId", item.id)
      void imageGallery.show(item.imageIds, index, item.id, creatorMeta)
    },
  },
}
</script>

<style scoped>
.container {
  display: grid;
  /* grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); */
  /* grid-auto-rows: 120px; */
  gap: 8px;
  grid-auto-flow: dense;
}

@media (max-width: 600px) {
  .container {
    grid-template-columns: repeat(2, 1fr) !important; /* 2 columns for smaller screens */
  }
}

@media (min-width: 601px) and (max-width: 900px) {
  .container {
    grid-template-columns: repeat(3, 1fr) !important; /* 3 columns for medium screens */
  }
}

@media (min-width: 901px) {
  .container {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) !important; /* Default for larger screens */
  }
}

.container > div {
  position: relative;
  overflow: hidden;
  min-width: 50px;
}

.container-image {
  width: 100%;
  height: 100%;
  object-fit: cover !important;
}

/* Restored the classes for varying grid item sizes */
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
