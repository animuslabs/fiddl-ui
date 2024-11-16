<template lang="pug">
q-page.full-height.full-width
  //- .centered.q-mt-sm
  //-   h4 Creations
  div
    .centered.q-pb-md
      q-tabs(v-model="tab" class="full-width"  active-color="white" indicator-color="secondary" inline-label active-class="accent" )
        q-tab(v-for="tab in tabs" :key="tab.name" :name="tab.name"  )
          .row.items-center.full-width
            .centered
              q-icon(:name="tab.icon" size="25px").q-ml-sm
            .q-ml-sm.gt-sm {{ tab.label }}

    //- q-separator(color="primary")
  .centered
    q-scroll-area(style="width:1900px; height:calc(100vh - 135px); max-width:95vw; overflow:auto")
      .centered.q-gutter-md(v-if="tab === 'creations'")
        div(v-for="creation in creationsStore.creations"  :key="creation.id").q-mr-md.q-pl-md.full-width
          ImageRequestCard(:creation="creation" @setRequest="editOnCreatePage")
      .centered.q-gutter-md(v-if="tab === 'purchased'")
        div(v-for="purchase in creationsStore.imagePurchases"  :key="purchase.id").q-mr-md
          CreatedImageCard(:imageId="purchase.imageId" style="width:300px; height:300px;" @click="showGallery(purchase.imageId)").cursor-pointer
      .centered.q-gutter-md(v-if="tab === 'favorites'")
        div(v-for="favoriteImage in creationsStore.favorites"  :key="favoriteImage.id").q-mr-md
          CreatedImageCard(:imageId="favoriteImage.id" style="width:300px; height:300px;" @click="showGallery(favoriteImage.id)").cursor-pointer
      .centered.q-ma-md
        q-btn(label="Load More" @click="load()")


</template>

<script lang="ts">
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import imageGallery from "lib/imageGallery"
import { img } from "lib/netlifyImg"
import { extractImageId, toObject } from "lib/util"
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
        { label: "My Creations", name: "creations", icon: "sym_o_create" },
        { label: "unlocked Images", name: "purchased", icon: "sym_o_lock_open" },
        { label: "Favorites", name: "favorites", icon: "sym_o_favorite" },
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
          void this.creationsStore.loadFavorites()
        }
      },
    },
  },

  mounted() {
    this.creationsStore.reset()
    void this.load()
  },
  methods: {
    load() {
      if (this.tab === "creations") {
        void this.creationsStore.loadCreations()
      } else if (this.tab === "purchased") {
        void this.creationsStore.loadPurchases()
      } else if (this.tab === "favorites") {
        void this.creationsStore.loadFavorites()
      }
    },
    editOnCreatePage(requestData: CreateImageRequest) {
      console.log("editOnCreatePage")
      const req = toObject(requestData)
      if (req.seed) req.seed = undefined
      const encodedRequest = encodeURIComponent(JSON.stringify(req))
      void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
    },
    async showGallery(imageId: string) {
      let allImages: string[] = []
      if (this.tab == "purchased") allImages = this.creationsStore.imagePurchases.map((el) => el.imageId)
      else if (this.tab == "favorites") allImages = this.creationsStore.favorites.map((el) => el.id)
      else return
      const index = allImages.findIndex((el) => el === imageId)
      // const creatorName = (await this.$api.user.getUsername.query(creatorId).catch(console.error)) || ""
      await imageGallery.show(allImages, index)
      this.load()
    },
  },
})
</script>
