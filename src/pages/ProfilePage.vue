<template lang="pug">
.full-height.full-width
  .centered(v-if="publicProfile").q-mt-md.q-mb-md
    ProfileCard(:profile="publicProfile" :userId="userId" :favoritesCount="creationsStore.favorites.length")
  div
    .centered
      q-tabs(v-model="tab" class="full-width"  active-color="white" indicator-color="secondary" inline-label active-class="accent" )
        q-tab(v-for="tab in tabs" :key="tab.name" :name="tab.name"  )
          .row.items-center.full-width
            .centered
              q-icon(:name="tab.icon" size="25px").q-ml-sm
            .q-ml-sm.gt-sm {{ tab.label }}

    //- q-separator(color="primary")
  .centered
    //- q-scroll-area(style="width:1900px; height:calc(100vh - 135px); max-width:95vw; overflow:auto")
    div.q-ma-md
      .centered.q-gutter-md(v-if="tab === 'creations'")
        div(v-for="creation in creationsStore.creations"  :key="creation.id").q-mr-md.q-pl-md.full-width
          ImageRequestCard(:creation="creation" @setRequest="editOnCreatePage")
      .centered.q-gutter-md(v-if="tab === 'purchased'")
        div(v-for="purchase in creationsStore.imagePurchases"  :key="purchase.id").q-mr-md
          CreatedImageCard(:imageId="purchase.imageId" style="width:300px; height:300px;" @click="showGallery(purchase.imageId)").cursor-pointer
      .centered.q-gutter-md(v-if="tab === 'favorites'")
        div(v-for="favoriteImage in creationsStore.favorites"  :key="favoriteImage.id").q-mr-md
          CreatedImageCard(:imageId="favoriteImage.id" style="width:300px; height:300px;" @click="showGallery(favoriteImage.id)").cursor-pointer
      //- .centered.q-ma-md
      //-   q-btn(label="Load More" @click="load()")


</template>

<script lang="ts">
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { PublicProfile } from "lib/api"
import imageGallery from "lib/imageGallery"
import { img } from "lib/netlifyImg"
import { catchErr, extractImageId, toObject } from "lib/util"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import ImageRequestCard from "src/components/ImageRequestCard.vue"
import ProfileCard from "src/components/ProfileCard.vue"
import { BrowserItem } from "src/stores/browserStore"
import { useCreations } from "src/stores/creationsStore"
import { defineComponent } from "vue"

export default defineComponent({
  components: {
    ImageRequestCard,
    CreatedImageCard,
    ProfileCard,
  },
  props: {
    userId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      publicProfile: null as PublicProfile | null,
      creationsStore: useCreations(),
      tab: "favorites",
      tabs: [
        { label: "Favorites", name: "favorites", icon: "sym_o_favorite" },
        { label: "Created", name: "creations", icon: "sym_o_create" },
        // { label: "unlocked Images", name: "purchased", icon: "sym_o_lock_open" },
      ],
    }
  },
  watch: {
    userId: {
      immediate: true,
      async handler(val, oldVal) {
        if (!val || oldVal != val) this.creationsStore.reset()
        this.creationsStore.activeUserId = val
        this.publicProfile = (await this.$api.user.publicProfile.query(val).catch(catchErr)) || null
        void this.load()
      },
    },
    tab: {
      immediate: true,
      handler() {
        void this.load()
      },
    },
  },

  mounted() {},
  methods: {
    load() {
      if (this.tab === "creations") {
        void this.creationsStore.loadCreations(this.userId)
      } else if (this.tab === "purchased") {
        void this.creationsStore.loadPurchases(this.userId)
      } else if (this.tab === "favorites") {
        void this.creationsStore.loadFavorites(this.userId)
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
      await imageGallery.show(allImages, index)
      this.load()
    },
  },
})
</script>
