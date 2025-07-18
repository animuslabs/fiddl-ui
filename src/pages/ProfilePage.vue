<template lang="pug">
q-page.full-height.full-width
  .centered(v-if="publicProfile").q-mt-md.q-mb-md
    ProfileCard(v-if="userId" :profile="publicProfile" :userId="userId" :favoritesCount="creationsStore.favorites.length")
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
          ImageRequestCard(:creation="creation" @setRequest="editOnCreatePage" @deleted="handleDeleted")
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
import { CreateImageRequest } from "../../../fiddl-server/dist/lib/types/serverTypes"
import { PublicProfile } from "lib/api"
import mediaViwer from "lib/mediaViewer"
import { img } from "lib/netlifyImg"
import { catchErr, extractImageId, getReferredBy, setReferredBy, toObject } from "lib/util"
import { Notify } from "quasar"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import ProfileCard from "src/components/ProfileCard.vue"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { defineComponent } from "vue"
import { userPublicProfile, userFindByUsername } from "src/lib/orval"
import { MediaGalleryMeta } from "src/components/MediaGallery.vue"

export default defineComponent({
  components: {
    ImageRequestCard,
    CreatedImageCard,
    ProfileCard,
  },
  props: {},
  data() {
    return {
      userId: null as null | string,
      publicProfile: null as PublicProfile | null,
      creationsStore: useImageCreations(),
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
        if (!val) return
        this.creationsStore.activeUserId = val
        const profileResponse = await userPublicProfile({ userId: val }).catch(catchErr)
        this.publicProfile = profileResponse?.data || null
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
  async mounted() {
    this.creationsStore.$reset()
    const username = this.$route.params?.username
    if (!username || typeof username != "string") return
    const userIdResponse = await userFindByUsername({ username }).catch(console.error)
    const userId = userIdResponse?.data
    if (!userId) {
      this.userId = null
      Notify.create({ message: "User not found", color: "negative" })
      void this.$router.replace({ name: "index" })
      return
    } else {
      this.userId = userId
    }
    const referrerAlreadySet = getReferredBy()
    if (!referrerAlreadySet) setReferredBy(username)
  },
  methods: {
    handleDeleted(requestId: string) {
      this.creationsStore.creations = this.creationsStore.creations.filter((el) => el.id !== requestId)
    },
    load() {
      if (!this.userId) return
      this.creationsStore.resetFilters()
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
      let allImages: MediaGalleryMeta[] = []
      if (this.tab == "purchased") allImages = this.creationsStore.imagePurchases.map((el) => ({ id: el.id, type: "image" }))
      else if (this.tab == "favorites") allImages = this.creationsStore.favorites.map((el) => ({ id: el.id, type: "image" }))
      else return
      const index = allImages.findIndex((el) => el.id === imageId)
      // const creatorName = (await this.$api.user.getUsername.query(creatorId).catch(console.error)) || ""
      await mediaViwer.show(allImages, index)
      this.load()
    },
  },
})
</script>
