<template lang="pug">
q-page.full-height.full-width
  //- .centered.q-mt-sm
  //-   h4 Creations
  div
    .centered
      q-tabs(v-model="tab" class="full-width"  active-color="white" indicator-color="secondary" inline-label active-class="accent" )
        q-tab(v-for="tab in tabs" :key="tab.name" :name="tab.name"  )
          .row.items-center.full-width
            .centered
              q-icon(:name="tab.icon" size="25px").q-ml-sm
            .q-ml-sm.gt-sm {{ tab.label }}

    //- q-separator(color="primary")
  //- .centered.relative-position(style="height:40px;")
  .relative-position
    .centered
      CreationsSearchBar(v-if="tab === 'creations'")
  .centered
    q-scroll-area(style="width:1800px; height:calc(100vh - 155px); max-width:95vw; overflow:auto")
      .full-width(style='height:60px;')
      .centered(v-if="tab === 'creations'")
        div(v-if="!creationsStore.gridMode" v-for="creation in creationsStore.creations"  :key="creation.id").full-width.q-pr-md.q-pl-md
          ImageRequestCard(:creation="creation" @setRequest="editOnCreatePage" @deleted="handleDeleted" )
        .centered.q-gutter-md(v-else v-for="image in creationsStore.allCreationImages"  :key="image.imageId+'1'")
          CreatedImageCard.q-ma-md.relative-position(:imageId="image.imageId" style="width:160px; height:160px;" @click="showDetails(image.creationId)").cursor-pointer
      .centered.q-gutter-md(v-if="tab === 'purchased'")
        div(v-for="purchase in creationsStore.imagePurchases"  :key="purchase.id")
          CreatedImageCard(:imageId="purchase.imageId" style="width:300px; height:300px;" @click="showGallery(purchase.imageId)").cursor-pointer
      .centered.q-gutter-md(v-if="tab === 'favorites'")
        div(v-for="favoriteImage in creationsStore.favorites"  :key="favoriteImage.id")
          CreatedImageCard(:imageId="favoriteImage.id" style="width:300px; height:300px;" @click="showGallery(favoriteImage.id)").cursor-pointer
      .centered.q-ma-md
        q-btn(label="Load More" @click="load()")
  q-dialog(v-model="showRequest")
    q-card
      ImageRequestCard(v-if="selectedRequest" :creation="selectedRequest" @setRequest="editOnCreatePage" @deleted="handleDeleted" style="max-height:90vh; overflow:auto")
      .centered.q-ma-md
        q-btn(label="Back" @click="showRequest = false" color="accent" flat)



</template>

<script lang="ts">
import { CreateImageRequest, CreateImageRequestData } from "../../../fiddl-server/dist/lib/types/serverTypes"
import imageGallery from "lib/imageGallery"
import { img } from "lib/netlifyImg"
import { extractImageId, toObject } from "lib/util"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import CreationsSearchBar from "src/components/CreationsSearchBar.vue"
import ImageRequestCard from "src/components/ImageRequestCard.vue"
import { BrowserItem } from "src/stores/browserStore"
import { useCreations } from "src/stores/imageCreationsStore"
import { defineComponent } from "vue"

export default defineComponent({
  components: {
    ImageRequestCard,
    CreatedImageCard,
    CreationsSearchBar,
  },
  data() {
    return {
      creationsStore: useCreations(),
      tab: "creations",
      showRequest: false,
      selectedRequest: null as CreateImageRequestData | null,
      tabs: [
        { label: "My Creations", name: "creations", icon: "sym_o_create" },
        { label: "unlocked Images", name: "purchased", icon: "sym_o_lock_open" },
        { label: "Favorites", name: "favorites", icon: "sym_o_favorite" },
      ],
    }
  },
  watch: {
    tab() {
      this.load()
    },
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        console.log("userAuth triggered", val)
        if (!val) {
          this.creationsStore.reset()
          this.creationsStore.resetFilters()
        } else {
          this.creationsStore.reset()
          this.creationsStore.resetFilters()
          this.load()
        }
      },
    },
  },

  mounted() {
    this.creationsStore.$reset()
  },
  methods: {
    showDetails(creationId: string) {
      const creation = this.creationsStore.creations.find((el) => el.id === creationId)
      if (!creation) return
      this.selectedRequest = creation
      this.showRequest = true
    },
    handleDeleted(requestId: string) {
      console.log("handleDeleted", requestId)
      this.creationsStore.creations = this.creationsStore.creations.filter((el) => el.id !== requestId)
      if (this.showRequest && this.selectedRequest?.id === requestId) {
        this.showRequest = false
        this.selectedRequest = null
      }
    },
    load() {
      if (this.tab === "creations") {
        void this.creationsStore.loadCreations()
      } else if (this.tab === "purchased") {
        this.creationsStore.resetFilters()
        void this.creationsStore.loadPurchases()
      } else if (this.tab === "favorites") {
        this.creationsStore.resetFilters()
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
