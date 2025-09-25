<template lang="pug">
q-page.full-height.full-width
  .centered(v-if="publicProfile").q-mt-md.q-mb-md
    ProfileCard(v-if="userId" :profile="publicProfile" :userId="userId" :favoritesCount="imageCreations.favorites.length")

  div
    .centered
      q-tabs(v-model="tab" class="full-width" active-color="white" indicator-color="secondary" inline-label active-class="accent")
        q-tab(v-for="t in tabs" :key="t.name" :name="t.name")
          .row.items-center.full-width
            .centered
              q-icon(:name="t.icon" size="25px").q-ml-sm
            .q-ml-sm.gt-sm {{ t.label }}

  .full-width
    .full-width(style="height:15px;").gt-sm
    .full-width(style="height:75px;").lt-md

    q-card.q-pa-sm.sticky-top.blur-bg(ref="filtersBar" style="z-index:100; top:50px;" v-if="tab !== 'forgeModels'")
      .row.q-gutter-md.items-center.no-wrap.hide-scrollbar(style="overflow:auto; width:fit-content; max-width:100vw;")
        q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
        q-separator(vertical v-if="tabHasMedia").gt-xs
        q-btn-dropdown(
          :label="mediaTypeFilter"
          flat
          color="primary"
          :icon="mediaTypeIcon[mediaTypeFilter]"
          v-if="tabHasMedia"
        ).gt-xs
          q-list
            .q-ma-md.cursor-pointer.relative-position(
              v-for="(icon, m) in mediaTypeIcon"
              :key="m"
              clickable
              @click="setMediaTypeFilter(m)"
              v-close-popup
            )
              .absolute.bg-primary(style="left:-5px; height:100%; width:5px;" v-if="mediaTypeFilter === m")
              .row.items-center.no-wrap
                q-icon.q-mr-md.q-ml-sm(:name="icon" size="md")
                p {{ m }}
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
          v-if="tabHasMedia"
          :color="showAdvancedFilters ? 'primary' : 'grey-6'"
        ).gt-xs

        .row.justify-center.q-mb-sm.no-wrap.nowrap-flex.hide-scrollbar(ref="topPager" v-if="usesPager" style="overflow:auto; max-width:100vw;")
          AppPagination(
            v-model="page"
            :max="pagerMax"
            color="primary"
            size="sm"
            :max-pages="8"
            :boundary-links="true"
            :direction-links="true"
            @update:model-value="onPageChange()"
          )

      .row.q-gutter-sm.items-center.no-wrap.q-mt-sm(v-if="showAdvancedFilters && tabHasMedia")
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

      .row.q-gutter-sm.items-center.justify-center.q-mt-sm.lt-sm(v-if="tabHasMedia")
        q-btn-dropdown(:label="mediaTypeFilter" flat color="primary" :icon="mediaTypeIcon[mediaTypeFilter]").lt-sm
          q-list
            .q-ma-sm.cursor-pointer.relative-position(
              v-for="(icon, m) in mediaTypeIcon"
              :key="m"
              clickable
              @click="setMediaTypeFilter(m)"
              v-close-popup
            )
              .absolute.bg-primary(style="left:-5px; height:100%; width:3px;" v-if="mediaTypeFilter === m")
              .row.items-center.no-wrap
                q-icon.q-mr-sm(:name="icon" size="sm")
                p(style="font-size:12px;") {{ m }}
        q-btn(
          icon="search"
          size="xs"
          flat
          round
          @click="toggleAdvancedFilters"
          v-if="tabHasMedia"
          :color="showAdvancedFilters ? 'primary' : 'grey-6'"
        )

    .centered.q-pa-md
      template(v-if="tab === 'creations'")
        div(v-if="gridMode === 'list'")
          div(v-for="creation in filteredCreations" :key="creation.id").full-width.q-pr-md.q-pl-md.q-mb-md
            ImageRequestCard(:creation="creation" @setRequest="editOnCreatePage" @deleted="handleDeleted")
        MediaGallery.q-pl-md.q-pr-md(
          v-else
          @selected-index="onSelectMedia"
          selectable
          :cols-desktop="galleryCols"
          :thumb-size-desktop="galleryThumb"
          :rowHeightRatio="1"
          :layout="galleryLayout"
          :mediaObjects="currentMediaObjects"
          show-popularity
          :show-delete-button="userAuth.userId === userId && tab === 'creations'"
          :show-use-as-input="true"
        )

      template(v-else-if="tab === 'favorites' || tab === 'purchased' || tab === 'unlocked'")
        MediaGallery.q-pl-md.q-pr-md(
          @selected-index="onSelectMedia"
          selectable
          :cols-desktop="galleryCols"
          :thumb-size-desktop="galleryThumb"
          :rowHeightRatio="1"
          :layout="galleryLayout"
          :mediaObjects="currentMediaObjects"
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
                  q-btn(@click="editingUsername = true" round flat icon="edit" size="sm" )
                .col-grow
                .col-auto
                  q-btn(v-if="userAuth.userProfile?.username" label="Get Referral Link" @click="copyRefLink()")
                  div(v-else) Set a username to get a referral link

              .row.q-gutter-md.items-center(v-else)
                .col-auto
                  q-input.q-pb-md(prefix="@" v-model="newUsername" label="Username" :rules="[validateUsername]" clearable)
                .col-auto
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

    .row.justify-center.q-mt-md.q-mb-md.q-pa-sm.no-wrap.nowrap-flex.hide-scrollbar(v-if="usesPager" style="overflow:auto; max-width:100vw;")
      AppPagination(
        v-model="page"
        :max="pagerMax"
        color="primary"
        size="md"
        :max-pages="8"
        :boundary-links="true"
        :direction-links="true"
        @update:model-value="onPageChange()"
      )

    .centered.q-ma-md(v-else-if="shouldShowLoadMore")
      q-btn(label="Load More" @click="loadMore()" :disable="!canLoadMore")

    .centered.q-ma-md(v-if="shouldShowEmptyMessage")
      h5.text-grey-6 No {{ emptyLabel }} found

  q-dialog(v-model="showRequest")
    q-card
      ImageRequestCard(
        v-if="selectedRequest"
        :creation="selectedRequest"
        @setRequest="showRequest = false"
        @deleted="showRequest = false"
        style="max-height:90vh; max-height:90dvh; overflow:auto"
      )
      .centered.q-ma-md
        q-btn(label="Back" @click="showRequest = false" color="accent" flat)
</template>

<script lang="ts">
import { defineComponent, nextTick } from "vue"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { PublicProfile } from "lib/api"
import mediaViwer from "lib/mediaViewer"
import { img, s3Video } from "lib/netlifyImg"
import { catchErr, toObject, getReferredBy, setReferredBy } from "lib/util"
import { LocalStorage, Notify, copyToClipboard, Dialog, scroll as qScroll } from "quasar"
import { userSetUsername, userPublicProfile, userFindByUsername } from "src/lib/orval"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import ProfileCard from "src/components/ProfileCard.vue"
import MediaGallery, { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import AppPagination from "src/components/AppPagination.vue"
import ModelCard from "src/components/ModelCard.vue"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { imageModels, videoModels } from "lib/imageModels"
import type { MediaType, UnifiedRequest } from "lib/types"
import { mediaTypeIcon } from "src/stores/browserStore"
import * as modelsStore from "src/stores/modelsStore"
import { useUserAuth } from "src/stores/userAuth"
import { fetchCollectionMedia } from "src/lib/collectionsApi"
import { match } from "ts-pattern"

export default defineComponent({
  components: { ImageRequestCard, ProfileCard, MediaGallery, AppPagination, ModelCard },
  data() {
    return {
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
      editingUsername: false,
      newUsername: "",
      modelsStore,
      gridModeOptions: [
        { icon: "dashboard", value: "mosaic" },
        { icon: "grid_view", value: "grid" },
      ],
      mediaTypeIcon,
      page: 1,
      pageSize: 30,
      favoritesPageItems: [] as MediaGalleryMeta[],
    }
  },
  computed: {
    tabs() {
      const t = [
        { label: "Favorites", name: "favorites", icon: "sym_o_favorite" },
        { label: "Created", name: "creations", icon: "sym_o_create" },
        { label: "Forge Models", name: "forgeModels", icon: "auto_fix_high" },
      ]
      if (this.userAuth.loggedIn && this.userAuth.userId === this.userId) {
        t.push({ label: "Unlocked", name: "unlocked", icon: "sym_o_lock_open" })
      }
      return t
    },
    tabHasMedia() {
      return this.tab === "creations" || this.tab === "favorites" || this.tab === "purchased" || this.tab === "unlocked"
    },
    usesPager() {
      return this.tab === "creations" || this.tab === "favorites"
    },
    galleryLayout() {
      return this.gridMode === "mosaic" ? "mosaic" : "grid"
    },
    galleryCols() {
      return this.gridMode === "mosaic" ? 8 : 5
    },
    galleryThumb() {
      return this.gridMode === "mosaic" ? 165 : 190
    },
    activeCreationsStore() {
      return match(this.currentTab)
        .with("image", () => this.imageCreations)
        .with("video", () => this.videoCreations)
        .run()
    },
    modelOptions(): string[] {
      const a = imageModels.filter((m) => m !== "custom") as string[]
      const b = videoModels as readonly string[]
      return [...a, ...b].sort()
    },
    imageAspectMap(): Map<string, number> {
      const m = new Map<string, number>()
      for (const c of this.imageCreations.creations) {
        const ar = this.aspectRatioToNumber(c.aspectRatio)
        for (const id of c.mediaIds) m.set(id, ar || 0)
      }
      return m
    },
    videoAspectMap(): Map<string, number> {
      const m = new Map<string, number>()
      for (const c of this.videoCreations.creations) {
        const ar = this.aspectRatioToNumber(c.aspectRatio)
        for (const id of c.mediaIds) m.set(id, ar || 0)
      }
      return m
    },
    creationsMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "creations") return []
      return this.activeCreationsStore.allCreations.map((el) => {
        const creation = this.activeCreationsStore.creations.find((c: any) => c.id === el.creationId)
        const isImage = this.currentTab === "image"
        const mediaList = creation ? (isImage ? (creation as any).images : (creation as any).videos) : undefined
        const nsfw = Array.isArray(mediaList) ? mediaList.find((entry: any) => entry.id === el.id)?.nsfw : undefined

        if (isImage) {
          return {
            id: el.id,
            url: img(el.id, "md"),
            type: "image" as MediaType,
            aspectRatio: this.imageAspectMap.get(el.id),
            nsfw,
          }
        }

        return {
          id: el.id,
          url: s3Video(el.id, "preview-sm"),
          type: "video" as MediaType,
          aspectRatio: this.videoAspectMap.get(el.id),
          nsfw,
        }
      })
    },
    filteredCreations(): UnifiedRequest[] {
      if (this.tab !== "creations") return []
      const imgs = this.imageCreations.creations || []
      const vids = this.videoCreations.creations || []
      const combined = this.mediaTypeFilter === "all" ? [...imgs, ...vids] : this.mediaTypeFilter === "image" ? imgs : vids
      return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },
    filteredMediaObjects(): MediaGalleryMeta[] {
      if (this.tab !== "creations") return []
      type WithDate = MediaGalleryMeta & { createdAt?: Date }
      if (this.mediaTypeFilter === "all") {
        const list: WithDate[] = []
        this.imageCreations.creations.forEach((r: any) => {
          const images = (r as any)?.images
          const mediaList = Array.isArray(images) ? images : []
          r.mediaIds.forEach((id: string) => {
            const nsfw = mediaList.find((entry: any) => entry.id === id)?.nsfw
            list.push({
              id,
              url: img(id, "md"),
              type: "image",
              createdAt: r.createdAt,
              aspectRatio: this.aspectRatioToNumber(r.aspectRatio),
              nsfw,
            })
          })
        })
        this.videoCreations.creations.forEach((r: any) => {
          const mediaList = Array.isArray(r.videos) ? r.videos : []
          r.mediaIds.forEach((id: string) => {
            const nsfw = mediaList.find((entry: any) => entry.id === id)?.nsfw
            list.push({
              id,
              url: s3Video(id, "preview-sm"),
              type: "video",
              createdAt: r.createdAt,
              aspectRatio: this.aspectRatioToNumber(r.aspectRatio),
              nsfw,
            })
          })
        })
        return list.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      }
      if (this.mediaTypeFilter === "image") {
        return this.imageCreations.allCreations.map((el: any) => {
          const creation = this.imageCreations.creations.find((c: any) => c.id === el.creationId) as any
          const imgs = creation?.images
          const mediaList = creation && Array.isArray(imgs) ? imgs : []
          const nsfw = mediaList.find((entry: any) => entry.id === el.id)?.nsfw
          return {
            id: el.id,
            url: img(el.id, "md"),
            type: "image",
            aspectRatio: this.imageAspectMap.get(el.id),
            nsfw,
          }
        })
      }
      return this.videoCreations.allCreations.map((el: any) => {
        const creation = this.videoCreations.creations.find((c: any) => c.id === el.creationId) as any
        const media = creation?.videos
        const mediaList = creation && Array.isArray(media) ? media : []
        const nsfw = mediaList.find((entry: any) => entry.id === el.id)?.nsfw
        return {
          id: el.id,
          url: s3Video(el.id, "preview-sm"),
          type: "video",
          aspectRatio: this.videoAspectMap.get(el.id),
          nsfw,
        }
      })
    },
    favoritesMediaObjects(): MediaGalleryMeta[] {
      return this.tab === "favorites" ? this.favoritesPageItems : []
    },
    purchaseOrUnlockedMedia(): MediaGalleryMeta[] {
      if (!(this.tab === "purchased" || this.tab === "unlocked")) return []
      if (this.currentTab === "image") {
        return this.imageCreations.imagePurchases.map((el) => ({ id: el.imageId, url: img(el.imageId, "md"), type: "image" as MediaType }))
      }
      return this.videoCreations.imagePurchases.map((el) => ({ id: el.videoId, url: s3Video(el.videoId, "preview-sm"), type: "video" as MediaType }))
    },
    currentMediaObjects(): MediaGalleryMeta[] {
      if (this.tab === "creations") return this.filteredMediaObjects
      if (this.tab === "favorites") return this.favoritesMediaObjects
      if (this.tab === "purchased" || this.tab === "unlocked") return this.purchaseOrUnlockedMedia
      return []
    },
    userCustomModels() {
      return modelsStore.userModels.value
    },
    pagerMax(): number {
      const base = Math.max(1, this.page)
      if (this.tab === "favorites") {
        const hasNext = (this.favoritesPageItems?.length || 0) >= this.pageSize
        return Math.max(base, this.page + (hasNext ? 1 : 0))
      }
      if (this.tab === "creations") {
        if (this.mediaTypeFilter === "all") {
          const hasNext = this.imageCreations.creations.length >= this.pageSize || this.videoCreations.creations.length >= this.pageSize
          return Math.max(base, this.page + (hasNext ? 1 : 0))
        }
        if (this.mediaTypeFilter === "image") {
          const hasNext = this.imageCreations.creations.length >= this.pageSize
          return Math.max(base, this.page + (hasNext ? 1 : 0))
        }
        const hasNext = this.videoCreations.creations.length >= this.pageSize
        return Math.max(base, this.page + (hasNext ? 1 : 0))
      }
      return base
    },
    shouldShowLoadMore(): boolean {
      if (this.usesPager) return false
      if (this.tab === "forgeModels") return this.userCustomModels.length > 9
      if (this.tab === "purchased" || this.tab === "unlocked") return this.purchaseOrUnlockedMedia.length > 9
      return false
    },
    canLoadMore(): boolean {
      if (this.usesPager) return false
      if (this.tab === "forgeModels") return this.userCustomModels.length >= 1
      if (this.tab === "purchased" || this.tab === "unlocked") return this.purchaseOrUnlockedMedia.length >= 1
      return false
    },
    shouldShowEmptyMessage(): boolean {
      const imageNotLoading = !this.imageCreations.loadingCreations
      const videoNotLoading = !this.videoCreations.loadingCreations
      const isNotLoading = imageNotLoading && videoNotLoading
      if (this.tab === "creations") {
        if (this.mediaTypeFilter === "all") return isNotLoading && this.imageCreations.creations.length + this.videoCreations.creations.length === 0
        if (this.mediaTypeFilter === "image") return !this.imageCreations.loadingCreations && this.imageCreations.creations.length === 0
        return !this.videoCreations.loadingCreations && this.videoCreations.creations.length === 0
      }
      if (this.tab === "favorites") return this.favoritesPageItems.length === 0
      if (this.tab === "purchased" || this.tab === "unlocked") return !this.activeCreationsStore.loadingCreations && this.purchaseOrUnlockedMedia.length === 0
      if (this.tab === "forgeModels") return !modelsStore.loading.userModels && this.userCustomModels.length === 0
      return false
    },
    emptyLabel() {
      if (this.tab === "forgeModels") return "model"
      if (this.tab === "favorites") return "favorite"
      if (this.tab === "purchased") return "purchase"
      if (this.tab === "unlocked") return "item"
      return this.mediaTypeFilter === "all" ? "creation" : this.mediaTypeFilter
    },
  },
  watch: {
    userId: {
      immediate: true,
      async handler(val, oldVal) {
        if (!val || oldVal !== val) {
          this.imageCreations.reset()
          this.videoCreations.reset()
        }
        if (!val) return
        this.imageCreations.activeUserId = val
        this.videoCreations.activeUserId = val
        const profileResponse = await userPublicProfile({ userId: val }).catch(catchErr)
        this.publicProfile = profileResponse?.data || null
        this.loadByTab()
      },
    },
    tab: {
      immediate: true,
      handler() {
        this.searchQuery = ""
        this.showAdvancedFilters = false
        if (this.usesPager) this.page = 1
        this.loadByTab()
      },
    },
    currentTab() {
      this.searchQuery = ""
      this.showAdvancedFilters = false
      this.loadByTab()
    },
    mediaTypeFilter() {
      if (!this.tabHasMedia) return
      this.page = 1
      if (this.tab === "favorites") this.loadFavorites()
      else this.loadByTab()
    },
    gridMode(val) {
      LocalStorage.set("profilePageGridMode", val)
    },
    $route: {
      immediate: true,
      handler() {
        this.initFromRoute()
      },
    },
  },
  async mounted() {
    this.imageCreations.$reset()
    this.videoCreations.$reset()
    void nextTick(() => {
      this.gridMode = LocalStorage.getItem("profilePageGridMode") || "mosaic"
    })
  },
  methods: {
    async initFromRoute() {
      if (this.$route.name === "account") {
        // Avoid restoring login in Telegram Mini App mode
        const inTMA = typeof window !== "undefined" && ((window as any).__TMA__?.enabled || document.documentElement.classList.contains("tma-mode"))
        if (!this.userAuth.loggedIn && !inTMA) await this.userAuth.attemptAutoLogin()
        if (this.userAuth.loggedIn && !this.userAuth.userProfile) await this.userAuth.loadUserProfile()
        if (this.userAuth.loggedIn && this.userAuth.userProfile?.username) {
          void this.$router.replace({ name: "profile", params: { username: this.userAuth.userProfile.username }, query: { tab: "unlocked" } })
          return
        }
        void this.$router.replace({ name: "login", query: { redirect: "account" } })
        return
      }

      const username = this.$route.params?.username
      if (!username || typeof username !== "string") return
      const res = await userFindByUsername({ username }).catch(console.error)
      const uid = res?.data
      if (!uid) {
        this.userId = null
        Notify.create({ message: "User not found", color: "negative" })
        void this.$router.replace({ name: "index" })
        return
      }
      if (this.userId !== uid) {
        this.userId = uid
        this.activeCreationsStore.activeUserId = uid
      }
      if (!getReferredBy()) setReferredBy(username)

      const tabQuery = this.$route.query?.tab
      if (tabQuery && typeof tabQuery === "string" && this.tabs.some((t) => t.name === tabQuery)) {
        this.tab = tabQuery
      }
    },

    onPageChange() {
      this.scrollToTop()
      this.loadByTab()
    },

    scrollToTop(duration = 0) {
      nextTick(() => {
        const base: any = (this.$refs.filtersBar as any)?.$el || this.$el || window
        let target: any
        try {
          target = qScroll.getScrollTarget(base)
        } catch {
          target = document.scrollingElement || document.documentElement || window
        }
        try {
          qScroll.setVerticalScrollPosition(target, 0, duration)
        } catch {
          if (target && typeof target.scrollTo === "function") target.scrollTo({ top: 0, behavior: duration ? "smooth" : "auto" })
          else window.scrollTo(0, 0)
        }
      })
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
      } else if (this.tab === "favorites") {
        this.loadFavorites()
      }
    },

    onModelChange() {
      if (this.tab !== "creations") return
      this.page = 1
      if (this.selectedModel) {
        if (imageModels.includes(this.selectedModel as any)) {
          this.imageCreations.filter.model = this.selectedModel as any
          this.videoCreations.filter.model = undefined
          this.setMediaTypeFilter("image")
        } else if (videoModels.includes(this.selectedModel as any)) {
          this.videoCreations.filter.model = this.selectedModel as any
          this.imageCreations.filter.model = undefined
          this.setMediaTypeFilter("video")
        }
      } else {
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

    loadByTab() {
      if (!this.userId) return

      if (this.tab === "forgeModels") {
        modelsStore.models.userModels = []
        if (this.userId) void modelsStore.loadUserModels(this.userId)
        return
      }

      if (this.tab === "creations") {
        this.imageCreations.resetFilters()
        this.videoCreations.resetFilters()
        this.imageCreations.activeUserId = this.userId
        this.videoCreations.activeUserId = this.userId

        if (this.mediaTypeFilter === "all") {
          void this.imageCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
          void this.videoCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
        } else if (this.mediaTypeFilter === "image") {
          void this.imageCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
        } else {
          void this.videoCreations.loadCreationsPage(this.userId, this.page, this.pageSize)
        }
        return
      }

      if (this.tab === "favorites") {
        void this.loadFavorites()
        return
      }

      if (this.tab === "purchased" || this.tab === "unlocked") {
        void this.activeCreationsStore.loadPurchases(this.userId)
      }
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
      if (this.tab === "forgeModels" && this.userId) {
        const currentPage = Math.ceil(this.userCustomModels.length / 10) + 1
        void modelsStore.loadUserModels(this.userId, currentPage)
      } else if (this.tab === "purchased" || this.tab === "unlocked") {
        void this.activeCreationsStore.loadPurchases(this.userId || undefined)
      }
    },

    editOnCreatePage(requestData: CreateImageRequest) {
      const req = toObject(requestData)
      if (req.seed) req.seed = undefined
      const encodedRequest = encodeURIComponent(JSON.stringify(req))
      void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
    },

    onSelectMedia(mediaIndex: number) {
      const mediaObjects: MediaGalleryMeta[] = this.currentMediaObjects.map((el: any) => ({
        id: el.id,
        type: el.type || el.mediaType,
        nsfw: el.nsfw,
      }))
      void mediaViwer.show(mediaObjects, mediaIndex)
    },

    toModelPage(model: any) {
      if (model.id) void this.$router.push({ name: "model", params: { modelName: "custom", customModelId: model.id } })
      else void this.$router.push({ name: "model", params: { modelName: model.slug } })
    },

    validateUsername(username: string): string | true {
      const usernameRegex = /^[\w\p{Emoji}-]{2,15}$/u
      if (!username) return "Username is required."
      if (username.length < 2) return "Username must be at least 2 characters."
      if (username.length > 15) return "Username must not exceed 15 characters."
      if (!usernameRegex.test(username)) return "Username can only contain letters, numbers, underscores, hyphens, and emojis."
      return true
    },

    copyRefLink() {
      const refLink = window.location.origin + "/?referredBy=" + this.userAuth.userProfile?.username
      void copyToClipboard(refLink)
      Notify.create({ message: "Referral link copied to clipboard", color: "positive", icon: "check" })
    },

    setNewUsername() {
      void userSetUsername({ username: this.newUsername })
        .then(() => {
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
.hide-scrollbar {
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
