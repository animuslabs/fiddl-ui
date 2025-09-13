<template lang="pug">
q-page.full-height.full-width
  .centered(v-if="publicProfile").q-mt-md.q-mb-md
    ProfileCard(v-if="userId" :profile="publicProfile" :userId="userId" :favoritesCount="imageCreations.favorites.length")
  div
    .centered
      q-tabs(v-model="tab" class="full-width" active-color="white" indicator-color="secondary" inline-label active-class="accent")
        q-tab(v-for="tabItem in tabs" :key="tabItem.name" :name="tabItem.name")
          .row.items-center.full-width
            .centered
              q-icon(:name="tabItem.icon" size="25px").q-ml-sm
            .q-ml-sm.gt-sm {{ tabItem.label }}
  .full-width
    .full-width(style="height:15px;").gt-sm
    .full-width(style="height:75px;").lt-md
    q-card.q-pa-sm.sticky-top.blur-bg(ref="filtersBar" style="z-index:100; top:50px;" v-if="tab !== 'forgeModels'")
      .row.q-gutter-md.items-center.no-wrap
        q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
        q-separator(vertical v-if="tab === 'creations'").gt-xs
        q-btn-dropdown(
          :label="mediaTypeFilter"
          flat
          color="primary"
          :icon="mediaTypeIcon[mediaTypeFilter]"
          v-if="tab === 'creations' || tab === 'favorites'"
        ).gt-xs
          q-list
            .q-ma-md.cursor-pointer.relative-position(
              v-for="(icon, method) in mediaTypeIcon"
              clickable
              @click="setMediaTypeFilter(method)"
              v-close-popup
            )
              .absolute.bg-primary(style="left:-5px; height:100%; width:5px;" v-if="mediaTypeFilter == method")
              .row.items-center.no-wrap
                q-icon.q-mr-md.q-ml-sm(:name="icon" size="md")
                p {{ method }}
        q-separator(vertical v-if="tab === 'creations'").gt-xs
        q-select(
          v-model="selectedModel"
          :options="modelOptions"
          label="Model"
          clearable
          dense
          style="min-width:120px;"
          v-if="tab === 'creations'"
          @update:model-value="onModelChange"
        ).gt-xs
        q-btn(
          icon="search"
          size="sm"
          flat
          round
          @click="toggleAdvancedFilters"
          v-if="tab === 'creations' || tab === 'favorites'"
          :color="showAdvancedFilters ? 'primary' : 'grey-6'"
        ).gt-xs
        q-separator(vertical v-if="tab === 'creations'").gt-xs
        // Pagination controls (always on for creations/favorites)
        div.row.items-center.q-gutter-sm(ref="topPager" v-if="tab === 'creations' || tab === 'favorites'")
          q-input(dense outlined type="number" v-model.number="page" label="Page" style="width:90px" @update:model-value="goToPage()")
          q-input(dense outlined type="number" v-model.number="pageSize" label="Page Size" style="width:110px" @update:model-value="goToPage(true)")
          q-btn(size="sm" flat color="primary" label="Go" @click="goToPage()")
          q-separator(vertical)
          q-btn(icon="chevron_left" label="Prev" size="sm" flat @click="prevPage" :disable="page <= 1")
          q-btn(icon="chevron_right" label="Next" size="sm" flat @click="nextPage")
        .col-grow
      .row.q-gutter-sm.items-center.no-wrap.q-mt-sm(v-if="showAdvancedFilters && (tab === 'creations' || tab === 'favorites')")
        q-input(
          v-model="searchQuery"
          placeholder="Search prompts..."
          dense
          outlined
          clearable
          @update:model-value="onSearchChange"
          style="min-width:200px;"
        )
          template(v-slot:prepend)
            q-icon(name="search")
      .row.q-gutter-sm.items-center.justify-center.q-mt-sm.lt-sm(v-if="tab === 'creations' || tab === 'favorites'")
        q-btn-dropdown(
          :label="mediaTypeFilter"
          flat
          color="primary"
          :icon="mediaTypeIcon[mediaTypeFilter]"
        ).lt-sm
          q-list
            .q-ma-sm.cursor-pointer.relative-position(
              v-for="(icon, method) in mediaTypeIcon"
              clickable
              @click="setMediaTypeFilter(method)"
              v-close-popup
            )
              .absolute.bg-primary(style="left:-5px; height:100%; width:3px;" v-if="mediaTypeFilter == method")
              .row.items-center.no-wrap
                q-icon.q-mr-sm(:name="icon" size="sm")
                p(style="font-size:12px;") {{ method }}
        q-btn(
          icon="search"
          size="xs"
          flat
          round
          @click="toggleAdvancedFilters"
          v-if="tab === 'creations' || tab === 'favorites'"
          :color="showAdvancedFilters ? 'primary' : 'grey-6'"
        )

    .centered.q-pa-md
      template(v-if="tab === 'creations'")
        div(v-if="gridMode == 'list'")
          div(v-for="creation in filteredCreations" :key="creation.id").full-width.q-pr-md.q-pl-md.q-mb-md
            ImageRequestCard(:creation="creation" @setRequest="editOnCreatePage" @deleted="handleDeleted")
        MediaGallery.q-pl-md.q-pr-md(
          v-else-if="gridMode == 'mosaic'"
          @selected-index="showDetails"
          selectable
          :cols-desktop="8"
          :thumb-size-desktop="165"
          :rowHeightRatio="1"
          layout="mosaic"
          :mediaObjects="filteredMediaObjects"
          show-popularity
        )
        MediaGallery.q-pl-md.q-pr-md(
          v-else-if="gridMode == 'grid'"
          @selected-index="showDetails"
          selectable
          :cols-desktop="5"
          :thumb-size-desktop="190"
          style="max-width:1200px;"
          :rowHeightRatio="1"
          layout="grid"
          :mediaObjects="filteredMediaObjects"
          show-popularity
        )

      // Favorites tab - only show MediaGallery (no list view for individual images)
      template(v-else-if="tab === 'favorites'")
        MediaGallery.q-pl-md.q-pr-md(
          v-if="gridMode == 'mosaic'"
          @selected-index="showFavoritesDetails"
          selectable
          :cols-desktop="8"
          :thumb-size-desktop="165"
          :rowHeightRatio="1"
          layout="mosaic"
          :mediaObjects="favoritesMediaObjects"
          show-popularity
        )
        MediaGallery.q-pl-md.q-pr-md(
          v-else
          @selected-index="showFavoritesDetails"
          selectable
          :cols-desktop="5"
          :thumb-size-desktop="190"
          style="max-width:1200px;"
          :rowHeightRatio="1"
          layout="grid"
          :mediaObjects="favoritesMediaObjects"
          show-popularity
        )

      // Purchased tab - only show MediaGallery
      template(v-else-if="tab === 'purchased'")
        MediaGallery.q-pl-md.q-pr-md(
          v-if="gridMode == 'mosaic'"
          @selected-index="showPurchasedDetails"
          selectable
          :cols-desktop="8"
          :thumb-size-desktop="165"
          :rowHeightRatio="1"
          layout="mosaic"
          :mediaObjects="purchasedMediaObjects"
          show-popularity
        )
        MediaGallery.q-pl-md.q-pr-md(
          v-else
          @selected-index="showPurchasedDetails"
          selectable
          :cols-desktop="5"
          :thumb-size-desktop="190"
          style="max-width:1200px;"
          :rowHeightRatio="1"
          layout="grid"
          :mediaObjects="purchasedMediaObjects"
          show-popularity
        )
      template(v-else-if="tab === 'forgeModels'")
        .row.q-ma-md.full-width
          .col-12.col-sm-6.col-md-4.col-lg-3(v-for="model in userCustomModels" :key="model.slug" style="min-width:300px;")
            ModelCard.q-ma-sm(selectable :model="model" @click="toModelPage(model)")
        .centered.q-ma-md(v-if="userCustomModels.length === 0 && !modelsStore.loading.userModels")
          h5.text-grey-6 No custom models found
        .centered.q-ma-md(v-if="modelsStore.loading.userModels")
          q-spinner(size="40px")

      // Unlocked tab - show purchased/unlocked content (only visible when authenticated and viewing own profile)
      template(v-else-if="tab === 'unlocked'")
        MediaGallery.q-pl-md.q-pr-md(
          v-if="gridMode == 'mosaic'"
          @selected-index="showUnlockedDetails"
          selectable
          :cols-desktop="8"
          :thumb-size-desktop="165"
          :rowHeightRatio="1"
          layout="mosaic"
          :mediaObjects="unlockedMediaObjects"
          show-popularity
        )
        MediaGallery.q-pl-md.q-pr-md(
          v-else
          @selected-index="showUnlockedDetails"
          selectable
          :cols-desktop="5"
          :thumb-size-desktop="190"
          style="max-width:1200px;"
          :rowHeightRatio="1"
          layout="grid"
          :mediaObjects="unlockedMediaObjects"
          show-popularity
        )

      // Account Settings section (always visible when authenticated and viewing own profile)
      template(v-else-if="tab === 'accountSettings'")
        .centered.q-gutter-md.q-mt-md
          q-card
            q-card-section
              h3 Profile Settings
              h6 Username
              .row.q-gutter-md.items-center(v-if="!editingUsername")
                .col-auto
                  h5 {{ userAuth.userProfile?.username || "no username" }}
                .col-auto
                  div
                    q-btn(@click="editingUsername = true" round flat icon="edit" size="sm" )
                .col-grow
                .col-auto
                  div
                    q-btn(v-if="userAuth.userProfile?.username" label="Get Referral Link" @click="copyRefLink()")
                    div(v-else) Set a username to get a referral link

              .row.q-gutter-md.items-center(v-else)
                .col-auto
                  q-input.q-pb-md( prefix="@" v-model="newUsername" label="Username" :rules="[validateUsername]" clearable)
                .col-auto
                  div
                    q-btn(@click="editingUsername = false" round flat icon="close" color="negative")
                    q-btn(@click="setNewUsername()" round flat icon="check" color="positive")
              div(style="max-width: 400px;").q-mt-md
                p You will earn a 10% Fiddl Points bonus when users who register using your referral link purchase Fiddl Points.
              h6.q-pt-md Email
              .row.items-center
                div
                  h5 {{ userAuth.userProfile?.email?.toLowerCase() || "No Email" }}
                div.q-ml-md
                  q-icon(v-if="userAuth.userProfile?.emailVerified" name="check" color="positive" size="sm")
                  q-icon(v-else name="close" color="negative" size="sm")

      .centered.q-ma-md(v-if="tab === 'creations' || tab === 'favorites'")
        .row.items-center.q-gutter-sm
          q-btn(icon="chevron_left" label="Prev" @click="prevPage" :disable="page <= 1")
          div Page {{ page }}
          q-btn(icon="chevron_right" label="Next" @click="nextPage")
      .centered.q-ma-md(v-else-if="shouldShowLoadMore")
        q-btn(label="Load More" @click="loadMore()" :disable="!canLoadMore")

      .centered.q-ma-md(v-if="shouldShowEmptyMessage")
        h5.text-grey-6 No {{ currentTab }}s found

  q-dialog(v-model="showRequest")
    q-card
      ImageRequestCard(
        v-if="selectedRequest"
        :creation="selectedRequest"
        @setRequest="showRequest = false"
        @deleted="showRequest = false"
        style="max-height:90vh; overflow:auto"
      )
      .centered.q-ma-md
        q-btn(label="Back" @click="showRequest = false" color="accent" flat)
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { PublicProfile } from "lib/api"
import mediaViwer from "lib/mediaViewer"
import { img, s3Video } from "lib/netlifyImg"
import { catchErr, extractImageId, getReferredBy, setReferredBy, toObject } from "lib/util"
import { LocalStorage, Notify, useQuasar, copyToClipboard, Dialog } from "quasar"
import { userSetUsername } from "src/lib/orval"
import CreatedImageCard from "src/components/CreatedImageCard.vue"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import ProfileCard from "src/components/ProfileCard.vue"
import MediaGallery, { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { userPublicProfile, userFindByUsername } from "src/lib/orval"
import { match } from "ts-pattern"
import type { MediaType, UnifiedRequest } from "lib/types"
import { imageModels, videoModels } from "lib/imageModels"
import { mediaTypeIcon } from "src/stores/browserStore"
import ModelCard from "src/components/ModelCard.vue"
import * as modelsStore from "src/stores/modelsStore"
import { modelTags, type ModelTags } from "lib/imageModels"
import { useUserAuth } from "src/stores/userAuth"
import { fetchCollectionMedia } from "src/lib/collectionsApi"

export default defineComponent({
  components: {
    ImageRequestCard,
    CreatedImageCard,
    ProfileCard,
    MediaGallery,
    ModelCard,
  },
  data() {
    return {
      quasar: useQuasar(),
      userId: null as null | string,
      publicProfile: null as PublicProfile | null,
      imageCreations: useImageCreations(),
      videoCreations: useVideoCreations(),
      selectedRequest: null as UnifiedRequest | null,
      showRequest: false,
      tab: "favorites",
      currentTab: "image" as MediaType,
      gridMode: "mosaic" as "list" | "grid" | "mosaic",
      searchQuery: "",
      showAdvancedFilters: false,
      selectedModel: null as string | null,
      mediaTypeFilter: "all" as "all" | "image" | "video",
      userAuth: useUserAuth(),
      // Account page specific data
      editingUsername: false,
      newUsername: "",
      modelsStore: modelsStore,
      gridModeOptions: [
        { icon: "dashboard", value: "mosaic" },
        { icon: "grid_view", value: "grid" },
      ],
      mediaTypeOptions: [
        { icon: "image", value: "image", label: "Images" },
        { icon: "videocam", value: "video", label: "Videos" },
      ],
      mediaTypeIcon,
      img,
      page: 1,
      pageSize: 30,
      // Favorites (paged) data
      favoritesPageItems: [] as MediaGalleryMeta[],
    }
  },
  computed: {
    // Dynamic tabs based on authentication and current user
    tabs() {
      const baseTabs = [
        { label: "Favorites", name: "favorites", icon: "sym_o_favorite" },
        { label: "Created", name: "creations", icon: "sym_o_create" },
        { label: "Forge Models", name: "forgeModels", icon: "auto_fix_high" },
        // { label: "unlocked Images", name: "purchased", icon: "sym_o_lock_open" },
      ]

      // Add Unlocked tab if user is authenticated and viewing their own profile
      if (this.userAuth.loggedIn && this.userAuth.userId === this.userId) {
        baseTabs.push({ label: "Unlocked", name: "unlocked", icon: "sym_o_lock_open" })
      }

      return baseTabs
    },

    activeCreationsStore() {
      return match(this.currentTab)
        .with("image", () => this.imageCreations)
        .with("video", () => this.videoCreations)
        .run()
    },
    modelOptions(): string[] {
      const models: string[] = []
      const imageModelsList = imageModels.filter((m) => m !== "custom") as string[]
      const videoModelsList = videoModels as readonly string[]
      models.push(...imageModelsList)
      models.push(...videoModelsList)
      return models.sort()
    },

    // Build a map from mediaId -> aspect ratio (number) for fast lookups
    imageAspectMap(): Map<string, number> {
      const m = new Map<string, number>()
      for (const c of this.imageCreations.creations) {
        const ar = this.aspectRatioToNumber(c.aspectRatio)
        for (const id of c.mediaIds) m.set(id, ar)
      }
      return m
    },
    videoAspectMap(): Map<string, number> {
      const m = new Map<string, number>()
      for (const c of this.videoCreations.creations) {
        const ar = this.aspectRatioToNumber(c.aspectRatio)
        for (const id of c.mediaIds) m.set(id, ar)
      }
      return m
    },

    creationsMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "creations") return []
      return this.activeCreationsStore.allCreations.map((el) => {
        if (this.currentTab == "image")
          return { id: el.id, url: img(el.id, "md"), type: "image" as MediaType, aspectRatio: this.imageAspectMap.get(el.id) }
        else return { id: el.id, url: s3Video(el.id, "preview-sm"), type: "video" as MediaType, aspectRatio: this.videoAspectMap.get(el.id) }
      })
    },

    filteredCreations(): UnifiedRequest[] {
      if (this.tab !== "creations") return []
      const imageCreations = this.imageCreations.creations || []
      const videoCreations = this.videoCreations.creations || []

      let combined: UnifiedRequest[] = []
      if (this.mediaTypeFilter === "all") {
        combined = [...imageCreations, ...videoCreations]
      } else if (this.mediaTypeFilter === "image") {
        combined = imageCreations
      } else if (this.mediaTypeFilter === "video") {
        combined = videoCreations
      }

      return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },
    filteredMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "creations") return []
      type GalleryMetaWithDate = MediaGalleryMeta & { createdAt?: Date }
      let mediaObjects: GalleryMetaWithDate[] = []

      if (this.mediaTypeFilter === "all") {
        const imageCreations = this.imageCreations.creations || []
        const videoCreations = this.videoCreations.creations || []
        let allMediaObjects: GalleryMetaWithDate[] = []

        imageCreations.forEach((request) => {
          request.mediaIds.forEach((mediaId) => {
            allMediaObjects.push({
              id: mediaId,
              url: img(mediaId, "md"),
              type: "image" as MediaType,
              createdAt: request.createdAt,
              aspectRatio: this.aspectRatioToNumber(request.aspectRatio),
            })
          })
        })
        videoCreations.forEach((request) => {
          request.mediaIds.forEach((mediaId) => {
            allMediaObjects.push({
              id: mediaId,
              url: s3Video(mediaId, "preview-sm"),
              type: "video" as MediaType,
              createdAt: request.createdAt,
              aspectRatio: this.aspectRatioToNumber(request.aspectRatio),
            })
          })
        })

        // Combine and sort by creation time
        mediaObjects = allMediaObjects.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      } else if (this.mediaTypeFilter === "image") {
        mediaObjects = this.imageCreations.allCreations.map((el) => ({
          id: el.id,
          url: img(el.id, "md"),
          type: "image" as MediaType,
          aspectRatio: this.imageAspectMap.get(el.id),
        }))
      } else if (this.mediaTypeFilter === "video") {
        mediaObjects = this.videoCreations.allCreations.map((el) => ({
          id: el.id,
          url: s3Video(el.id, "preview-sm"),
          type: "video" as MediaType,
          aspectRatio: this.videoAspectMap.get(el.id),
        }))
      }

      return mediaObjects
    },
    favoritesMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "favorites") return []
      return this.favoritesPageItems
    },
    purchasedMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "purchased") return []
      if (this.currentTab === "image") {
        return this.imageCreations.imagePurchases.map((el) => ({
          id: el.imageId,
          url: img(el.imageId, "md"),
          type: "image" as MediaType,
        }))
      } else {
        return this.videoCreations.imagePurchases.map((el) => ({
          id: el.videoId,
          url: s3Video(el.videoId, "preview-sm"),
          type: "video" as MediaType,
        }))
      }
    },
    unlockedMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "unlocked") return []
      if (this.currentTab === "image") {
        return this.imageCreations.imagePurchases.map((el) => ({
          id: el.imageId,
          url: img(el.imageId, "md"),
          type: "image" as MediaType,
        }))
      } else {
        return this.videoCreations.imagePurchases.map((el) => ({
          id: el.videoId,
          url: s3Video(el.videoId, "preview-sm"),
          type: "video" as MediaType,
        }))
      }
    },
    userCustomModels() {
      return modelsStore.userModels.value
    },

    shouldShowLoadMore(): boolean {
      if (this.tab === "creations") {
        if (this.mediaTypeFilter === "all") {
          return this.imageCreations.creations.length + this.videoCreations.creations.length > 9
        } else if (this.mediaTypeFilter === "image") {
          return this.imageCreations.creations.length > 9
        } else if (this.mediaTypeFilter === "video") {
          return this.videoCreations.creations.length > 9
        }
      } else if (this.tab === "favorites") {
        return this.activeCreationsStore.favorites.length > 9
      } else if (this.tab === "purchased") {
        return this.activeCreationsStore.imagePurchases.length > 9
      } else if (this.tab === "forgeModels") {
        return this.userCustomModels.length > 9
      }
      return false
    },

    canLoadMore(): boolean {
      if (this.tab === "creations") {
        if (this.mediaTypeFilter === "all") {
          return this.imageCreations.creations.length + this.videoCreations.creations.length >= 1
        } else if (this.mediaTypeFilter === "image") {
          return this.imageCreations.creations.length >= 1
        } else if (this.mediaTypeFilter === "video") {
          return this.videoCreations.creations.length >= 1
        }
      } else if (this.tab === "favorites") {
        return this.activeCreationsStore.favorites.length >= 1
      } else if (this.tab === "purchased") {
        return this.activeCreationsStore.imagePurchases.length >= 1
      } else if (this.tab === "forgeModels") {
        return this.userCustomModels.length >= 1
      }
      return false
    },

    shouldShowEmptyMessage(): boolean {
      const imageNotLoading = !this.imageCreations.loadingCreations
      const videoNotLoading = !this.videoCreations.loadingCreations
      const isNotLoading = imageNotLoading && videoNotLoading

      if (this.tab === "creations") {
        if (this.mediaTypeFilter === "all") {
          return isNotLoading && this.imageCreations.creations.length + this.videoCreations.creations.length === 0
        } else if (this.mediaTypeFilter === "image") {
          return !this.imageCreations.loadingCreations && this.imageCreations.creations.length === 0
        } else if (this.mediaTypeFilter === "video") {
          return !this.videoCreations.loadingCreations && this.videoCreations.creations.length === 0
        }
      } else if (this.tab === "favorites") {
        return this.favoritesPageItems.length === 0
      } else if (this.tab === "purchased") {
        return !this.activeCreationsStore.loadingCreations && this.activeCreationsStore.imagePurchases.length === 0
      } else if (this.tab === "forgeModels") {
        return !modelsStore.loading.userModels && this.userCustomModels.length === 0
      }
      return false
    },
  },
  watch: {
    userId: {
      immediate: true,
      async handler(val, oldVal) {
        if (!val || oldVal != val) {
          this.imageCreations.reset()
          this.videoCreations.reset()
        }
        if (!val) return
        this.imageCreations.activeUserId = val
        this.videoCreations.activeUserId = val
        const profileResponse = await userPublicProfile({ userId: val }).catch(catchErr)
        this.publicProfile = profileResponse?.data || null
        void this.load()
      },
    },
    tab: {
      immediate: true,
      handler() {
        // Reset search when switching between favorites/creations
        this.searchQuery = ""
        this.showAdvancedFilters = false
        if (this.tab === 'creations') this.page = 1
        void this.load()
        if (this.tab === 'favorites' && this.userId) {
          void this.loadFavorites()
        }
      },
    },
    currentTab: {
      handler() {
        // Reset search when switching tabs
        this.searchQuery = ""
        this.showAdvancedFilters = false
        void this.load()
      },
    },
    mediaTypeFilter: {
      handler() {
        // When switching media type filter, reload data if needed
        if (this.tab === "creations") {
          this.page = 1
          void this.load()
        } else if (this.tab === 'favorites') {
          this.page = 1
          void this.loadFavorites()
        }
      },
    },
    // no pagination toggle – pagination always enabled
    gridMode(val) {
      LocalStorage.set("profilePageGridMode", this.gridMode)
    },
    "$route.params.username": {
      async handler() {
        const username = this.$route.params?.username
        if (!username || typeof username != "string") return

        const userIdResponse = await userFindByUsername({ username }).catch(console.error)
        const userId = userIdResponse?.data
        if (!userId) {
          this.userId = null
          Notify.create({ message: "User not found", color: "negative" })
          void this.$router.replace({ name: "index" })
          return
        }

        if (this.userId !== userId) {
          this.userId = userId
          this.activeCreationsStore.activeUserId = userId
        }

        const referrerAlreadySet = getReferredBy()
        if (!referrerAlreadySet) setReferredBy(username)

        const tabQuery = this.$route.query?.tab
        if (tabQuery && typeof tabQuery === "string") {
          void this.$nextTick(() => {
            if (this.tabs.some((t) => t.name === tabQuery)) {
              this.tab = tabQuery
            }
          })
        }
      },
    },
    "$route.query.tab": {
      handler(newTab) {
        if (typeof newTab !== "string") return
        void this.$nextTick(() => {
          if (this.tabs.some((t) => t.name === newTab)) {
            this.tab = newTab
          }
        })
      },
    },
  },
  async mounted() {
    this.imageCreations.$reset()
    this.videoCreations.$reset()

    // Load grid mode preference
    void this.$nextTick(() => {
      this.gridMode = LocalStorage.getItem("profilePageGridMode") || "mosaic"
    })

    // Handle account route - redirect to user's own profile with unlocked tab
    if (this.$route.name === "account") {
      // Try auto-login first if not already logged in
      if (!this.userAuth.loggedIn) {
        await this.userAuth.attemptAutoLogin()
      }

      // Load user profile if logged in but profile not loaded
      if (this.userAuth.loggedIn && !this.userAuth.userProfile) {
        await this.userAuth.loadUserProfile()
      }

      if (this.userAuth.loggedIn && this.userAuth.userProfile?.username) {
        void this.$router.replace({
          name: "profile",
          params: { username: this.userAuth.userProfile.username },
          query: { tab: "unlocked" },
        })
        return
      } else {
        // If not logged in, redirect to login page
        void this.$router.replace({ name: "login", query: { redirect: "account" } })
        return
      }
    }

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
      this.activeCreationsStore.activeUserId = userId // this didn't fix it
    }
    const referrerAlreadySet = getReferredBy()
    if (!referrerAlreadySet) setReferredBy(username)

    // Check for tab query parameter and set it if valid
    const tabQuery = this.$route.query?.tab
    if (tabQuery && typeof tabQuery === "string") {
      // Wait for tabs to be computed (after userAuth is loaded)
      void this.$nextTick(() => {
        if (this.tabs.some((t) => t.name === tabQuery)) {
          this.tab = tabQuery
        }
      })
    }
  },
  methods: {
    // Scroll the top pager row into view (mirrors AdminPage behavior)
    scrollTopPagerIntoView() {
      if (typeof window === 'undefined') return
      try {
        const refs: any = this.$refs || {}
        // Prefer a plain DOM element for precise alignment
        const el: HTMLElement | null = refs.topPager || (refs.filtersBar && (refs.filtersBar.$el || refs.filtersBar)) || null
        if (!el || typeof el.getBoundingClientRect !== 'function') return
        const rect = el.getBoundingClientRect()
        // Account for the fixed header/sticky offset so buttons are fully visible
        const headerOffset = 50 // keep in sync with sticky top
        const top = window.pageYOffset + rect.top - headerOffset
        try {
          window.scrollTo({ top, behavior: 'smooth' })
        } catch {
          window.scrollTo(0, top)
        }
      } catch {}
    },
    aspectRatioToNumber(raw?: string): number | undefined {
      if (!raw) return undefined
      if (raw.includes(":")) {
        const [w, h] = raw.split(":").map((x) => parseFloat(x))
        return h && w ? w / h : undefined
      }
      const n = parseFloat(raw)
      return Number.isFinite(n) ? n : undefined
    },
    handleDeleted(requestId: string) {
      this.activeCreationsStore.creations = this.activeCreationsStore.creations.filter((el) => el.id !== requestId)
    },
    onSearchChange() {
      this.page = 1
      if (this.tab === "creations") {
        this.imageCreations.search = this.searchQuery || null
        this.videoCreations.search = this.searchQuery || null
        this.imageCreations.searchCreations(this.userId || undefined)
        this.videoCreations.searchCreations(this.userId || undefined)
      } else if (this.tab === 'favorites') {
        void this.loadFavorites()
      }
    },
    onModelChange() {
      if (this.tab !== "creations") return
      this.page = 1

      // Apply model filter to both stores
      if (this.selectedModel) {
        // Check if it's an image model
        if (imageModels.includes(this.selectedModel as any)) {
          this.imageCreations.filter.model = this.selectedModel as any
          this.videoCreations.filter.model = undefined
          this.setMediaTypeFilter("image")
        }
        // Check if it's a video model
        else if (videoModels.includes(this.selectedModel as any)) {
          this.videoCreations.filter.model = this.selectedModel as any
          this.imageCreations.filter.model = undefined
          this.setMediaTypeFilter("video")
        }
      } else {
        // Clear filters
        this.imageCreations.filter.model = undefined
        this.videoCreations.filter.model = undefined
        this.setMediaTypeFilter("all")
      }

      this.imageCreations.searchCreations(this.userId || undefined)
      this.videoCreations.searchCreations(this.userId || undefined)
    },
    setMediaTypeFilter(type: "all" | "image" | "video") {
      this.mediaTypeFilter = type
    },
    toggleAdvancedFilters() {
      this.showAdvancedFilters = !this.showAdvancedFilters
      if (!this.showAdvancedFilters) {
        this.searchQuery = ""
        this.onSearchChange()
      }
    },
    load() {
      if (!this.userId) return

      // Reset userModels when switching tabs
      if (this.tab === "forgeModels") {
        modelsStore.models.userModels = []
      }

      if (this.tab === "creations") {
        // For creations, we need to load for the specific profile user, not the authenticated user
        // Reset filters and load creations as public data for this specific user
        this.imageCreations.resetFilters()
        this.videoCreations.resetFilters()
        this.imageCreations.activeUserId = this.userId
        this.videoCreations.activeUserId = this.userId

        // Load data based on media type filter (pagination always on)
        if (this.mediaTypeFilter === "all") {
          void this.imageCreations.loadCreationsPage(this.userId || undefined, this.page, this.pageSize)
          void this.videoCreations.loadCreationsPage(this.userId || undefined, this.page, this.pageSize)
        } else if (this.mediaTypeFilter === "image") {
          void this.imageCreations.loadCreationsPage(this.userId || undefined, this.page, this.pageSize)
        } else if (this.mediaTypeFilter === "video") {
          void this.videoCreations.loadCreationsPage(this.userId || undefined, this.page, this.pageSize)
        }
      } else if (this.tab === "purchased") {
        void this.activeCreationsStore.loadPurchases(this.userId)
      } else if (this.tab === "favorites") {
        // Use paged collection API for favorites
        void this.loadFavorites()
      } else if (this.tab === "forgeModels") {
        if (this.userId) {
          console.log("Loading forge models for userId:", this.userId)
          void modelsStore.loadUserModels(this.userId).then(() => {
            console.log("Loaded userModels:", modelsStore.userModels.value)
          })
        }
      } else if (this.tab === "unlocked") {
        // Load purchased content for unlocked tab
        void this.activeCreationsStore.loadPurchases(this.userId)
      }
    },
    goToPage(resetToFirstOnSize = false) {
      if (!this.userId) return
      if (this.page < 1) this.page = 1
      if (this.pageSize < 1) this.pageSize = 1
      if (resetToFirstOnSize) this.page = 1
      if (this.tab === 'creations') {
        if (this.mediaTypeFilter === "all") {
          void this.imageCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
          void this.videoCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
        } else if (this.mediaTypeFilter === "image") {
          void this.imageCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
        } else if (this.mediaTypeFilter === "video") {
          void this.videoCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
        }
      } else if (this.tab === 'favorites') {
        void this.loadFavorites()
      }
      this.scrollTopPagerIntoView()
    },
    prevPage() {
      if (this.page > 1) {
        this.page -= 1
        this.goToPage()
      }
    },
    nextPage() {
      this.page += 1
      this.goToPage()
    },
    async loadFavorites() {
      if (!this.userId) return
      const items = await fetchCollectionMedia({
        ownerId: this.userId,
        page: this.page,
        pageSize: this.pageSize,
        mediaType: this.mediaTypeFilter,
        search: this.searchQuery || null,
      })
      this.favoritesPageItems = items
    },
    loadMore() {
      if (this.tab === "creations") {
        this.nextPage()
      } else if (this.tab === "purchased") {
        void this.activeCreationsStore.loadPurchases(this.userId || undefined)
      } else if (this.tab === "favorites") {
        // Favorites uses explicit pagination controls
        void this.loadFavorites()
      } else if (this.tab === "forgeModels") {
        if (this.userId) {
          // Load more forge models (next page)
          const currentPage = Math.ceil(this.userCustomModels.length / 10) + 1
          void modelsStore.loadUserModels(this.userId, currentPage)
        }
      }
    },
    editOnCreatePage(requestData: CreateImageRequest) {
      console.log("editOnCreatePage")
      const req = toObject(requestData)
      if (req.seed) req.seed = undefined
      const encodedRequest = encodeURIComponent(JSON.stringify(req))
      void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
    },

    // For creations tab
    showDetails(mediaIndex: number) {
      const mediaObjects: MediaGalleryMeta[] = this.filteredMediaObjects.map((el) => ({
        id: el.id,
        type: el.type,
      }))
      void mediaViwer.show(mediaObjects, mediaIndex)
    },

    // For favorites tab
    showFavoritesDetails(mediaIndex: number) {
      const mediaObjects: MediaGalleryMeta[] = this.favoritesPageItems.map((el: any) => ({ id: el.id, type: (el.type || el.mediaType) }))
      void mediaViwer.show(mediaObjects, mediaIndex)
    },

    // For purchased tab
    showPurchasedDetails(mediaIndex: number) {
      let mediaObjects: MediaGalleryMeta[] = []
      if (this.currentTab === "image") {
        mediaObjects = this.imageCreations.imagePurchases.map((el) => ({
          id: el.imageId,
          type: this.currentTab,
        }))
      } else {
        mediaObjects = this.videoCreations.imagePurchases.map((el) => ({
          id: el.videoId,
          type: this.currentTab,
        }))
      }
      void mediaViwer.show(mediaObjects, mediaIndex)
    },

    // For unlocked tab
    showUnlockedDetails(mediaIndex: number) {
      let mediaObjects: MediaGalleryMeta[] = []
      if (this.currentTab === "image") {
        mediaObjects = this.imageCreations.imagePurchases.map((el) => ({
          id: el.imageId,
          type: this.currentTab,
        }))
      } else {
        mediaObjects = this.videoCreations.imagePurchases.map((el) => ({
          id: el.videoId,
          type: this.currentTab,
        }))
      }
      void mediaViwer.show(mediaObjects, mediaIndex)
    },

    // Navigation to model page
    toModelPage(model: any) {
      if (model.id) {
        void this.$router.push({ name: "model", params: { modelName: "custom", customModelId: model.id } })
      } else {
        void this.$router.push({ name: "model", params: { modelName: model.slug } })
      }
    },

    // Handle model tag selection
    selectModelTag(tag: ModelTags) {
      // Navigate to models page with the selected tag filter
      void this.$router.push({ name: "models", params: { filterTag: tag } })
    },

    // Account page methods
    validateUsername(username: string): string | true {
      // This regex allows letters, numbers, underscores, hyphens, and emojis, but no spaces
      const usernameRegex = /^[\w\p{Emoji}-]{2,15}$/u

      if (!username) {
        return "Username is required."
      }
      if (username.length < 2) {
        return "Username must be at least 2 characters."
      }
      if (username.length > 15) {
        return "Username must not exceed 15 characters."
      }
      if (!usernameRegex.test(username)) {
        return "Username can only contain letters, numbers, underscores, hyphens, and emojis."
      }

      return true
    },

    copyRefLink() {
      const refLink = window.location.origin + "/?referredBy=" + this.userAuth.userProfile?.username
      void copyToClipboard(refLink)
      Notify.create({ message: "Referral link copied to clipboard", color: "positive", icon: "check" })
    },

    setNewUsername() {
      void userSetUsername({ username: this.newUsername })
        .then((response) => {
          this.editingUsername = false
          void this.userAuth.loadUserProfile()
          Notify.create({ message: "Username updated", color: "positive", icon: "check" })
        })
        .catch((err: any) => {
          console.error(err)
          Dialog.create({ title: "Error Updating Username", message: err.message, color: "negative" })
        })
    },
  },
})
</script>

<style scoped>
.blur-bg {
  backdrop-filter: blur(10px);
  background-color: rgba(0, 0, 0, 0.7);
}

.sticky-top {
  position: sticky;
  top: 0;
  z-index: 100;
}
</style>
