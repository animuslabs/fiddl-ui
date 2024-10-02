<template lang="pug">
q-page.full-height.full-width
  //- .centered.q-mt-sm
  //-   h4 Creations
  div
    .centered.q-pb-md
      div(style="max-width:900px;")
        q-tabs(v-model="tab" align="justify" class="full-width"  active-color="white" indicator-color="secondary")
          q-tab(v-for="tab in tabs" :key="tab.name" :name="tab.name" :label="tab.label")
    //- q-separator(color="primary")
  .centered
    q-scroll-area(style="width:1900px; height:calc(100vh - 135px); max-width:95vw; overflow:auto")
      .centered.q-gutter-md(v-if="tab === 'creations'")
        div(v-for="creation in creationsStore.creations"  :key="creation.id").q-mr-md
          ImageRequestCard(:creation="creation")
      .centered.q-gutter-md(v-if="tab === 'purchased'")
        div(v-for="purchase in creationsStore.imagePurchases"  :key="purchase.id").q-mr-md
          CreatedImageCard(:imageId="purchase.imageId" style="width:300px; height:300px;" @click="showGallery(purchase.imageId)").cursor-pointer
      .centered.q-ma-md
        q-btn(label="Load More" @click="creationsStore.loadPurchases()")



</template>

<script lang="ts">
import { img } from "lib/netlifyImg"
import { extractImageId } from "lib/util"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import ImageRequestCard from "src/components/ImageRequestCard.vue"
import { BrowserItem } from "src/stores/browserStore"
import { useCreations } from "src/stores/creationsStore"
import { defineComponent } from "vue"

export default defineComponent({
  components: {
    ImageRequestCard,
    CreatedImageCard,
  },
  data() {
    return {
      creationsStore: useCreations(),
      tab: "creations",
      tabs: [
        { label: "My Creations", name: "creations" },
        { label: "Purchased Images", name: "purchased" },
      ],
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (!val) {
          this.creationsStore.reset()
        } else {
          void this.creationsStore.loadCreations()
          void this.creationsStore.loadPurchases()
        }
      },
    },
  },

  mounted() {},
  methods: {
    showGallery(imageId: string) {
      const allImages = this.creationsStore.imagePurchases.map((el) => el.imageId)
      const index = allImages.findIndex((el) => el === imageId)
      const imageUrls = allImages.map((el: any) => img(el, "md"))
      console.log("imageUrls", imageUrls)
      console.log("index", index)
      // @ts-expect-error root is not null
      this.$root.openDialog(index, imageUrls)
    },
  },
})
</script>
