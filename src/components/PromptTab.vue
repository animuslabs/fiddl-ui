<template lang="pug">
.centered.full-height.full-width
  .full-width
    .row.full-height.full-width.no-wrap
      .col-auto.q-ml-md( v-if="quasar.screen.gt.sm")
        // Make the create column sticky and full-height on desktop
        .centered(
          style="width:450px; padding:16px 0; position:sticky; top:60px; height:calc(100vh - 60px); height:calc(100dvh - 60px);"
        )
          CreateCard.full-width(
            @created="addImage"
            style="padding-top:0px; min-width:300px; max-width:600px; height:100%;"
            ref="createCard"
            :customModel="customModel"
            @active-tab="setActiveCreationsStore"
          )
      .col-grow.q-mr-sm.full-height
        q-scroll-area.full-width(:style="quasar.screen.gt.sm ? 'height:calc(100vh - 60px); height:calc(100dvh - 60px);' : 'height:calc(100vh - 110px); height:calc(100dvh - 110px);'")
          // top spacer to align right controls with create card
          .full-width(style="height:16px;").gt-sm
          .full-width.relative-position
            .full-width(style="height:55px;")
              q-card.q-pa-sm.fixed-top.blur-bg(style="z-index:100; margin:6px; top:10px;")
                .row.q-gutter-md.items-center.no-wrap
                  q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
                  q-separator(vertical)
                  q-btn-toggle(v-if="showModelFilter" v-model="activeCreationsStore.dynamicModel" :options="dynamicModelOptions" size="sm" flat)
                  .col-grow
                  q-btn.gt-sm(label="Magic Mirror" color="primary" rounded @click="showMMChoice = true")

            .centered
              // Initial loading skeletons for list mode
              div(v-if="gridMode === 'list' && showInitialLoading").full-width.q-pr-md.q-pl-md
                div(v-for="i in 5" :key="'skl-list-'+i" class="q-mb-md")
                  q-card
                    q-skeleton(type="rect" height="170px" animation="wave")
              // Animated list when items are present
              transition-group(
                v-else-if="gridMode === 'list'"
                name="fade-list"
                tag="div"
                class="full-width q-pr-md q-pl-md"
              )
                div(v-for="creation in activeCreationsStore.creations" :key="creation.id" class="full-width q-mb-md")
                  ImageRequestCard(:creation="creation")
              MediaGallery.q-pl-md.q-pr-md(
                :key="`mosaic-${currentTab}`"
                v-else-if="gridMode == 'mosaic'"
                @select="showDetailsBySelect"
                @model-select="handleModelSelect"
                selectable
                :mediaObjects="allMediaObjects"
                layout="mosaic"
                :rowHeightRatio="1.2"
                :show-loading="true"
                gap="8px"
                :cols-desktop="galleryColsDesktop"
                :thumb-size-desktop="90"
                :cols-mobile="galleryColsMobile"
                :thumb-size-mobile="60"
                :disable-nsfw-mask="true"
                :show-visibility-toggle="true"
                :show-delete-button="true"
                :show-use-as-input="true"
                :enable-model-chip-select="['image', 'video'].includes(currentTab)"
              )
              MediaGallery.q-pl-md.q-pr-md(
                :key="`grid-${currentTab}`"
                v-else-if="gridMode == 'grid'"
                @select="showDetailsBySelect"
                @model-select="handleModelSelect"
                selectable
                :cols-desktop="galleryColsDesktop"
                :cols-mobile="galleryColsMobile"
                :thumb-size-desktop="gridThumbSizeDesktop"
                :thumb-size-mobile="gridThumbSizeMobile"
                :rowHeightRatio="1"
                layout="grid"
                :mediaObjects="allMediaObjects"
                :show-loading="true"
                :disable-nsfw-mask="true"
                :show-visibility-toggle="true"
                :show-delete-button="true"
                :show-use-as-input="true"
                :enable-model-chip-select="['image', 'video'].includes(currentTab)"
              )
              //- div(v-else v-for="(creation,index) in activeCreationsStore.allCreations"  :key="creation.creationId+'1'")
              //-   CreatedImageCard.q-ma-sm.relative-position.cursor-pointer(:imageId="creation.id" style="width:150px; height:150px;" @click="showDetails(creation.creationId,index)")
          .centered.q-ma-md(v-if="activeCreationsStore.creations.length > 9")
            q-btn(
              label="Load More"
              @click="activeCreationsStore.loadCreations($userAuth.userId)"
              :disable="activeCreationsStore.creations.length < 1"
            )

  // Floating Action Buttons (mobile only) visible when viewing creations list
  q-btn.fab-create(
    v-if="quasar.screen.lt.md && !createMode"
    fab
    color="primary"
    icon="add"
    aria-label="Create"
    @click="createMode = true"
    label="Create"
  )
    q-tooltip(anchor="center left" self="center right") Create
  q-btn.fab-mm(
    v-if="quasar.screen.lt.md && !createMode"
    fab-mini
    color="primary"
    icon="auto_awesome"
    aria-label="Magic Mirror"
    @click="showMMChoice = true"
    label="Magic Mirror"
  )
    q-tooltip(anchor="center left" self="center right") Magic Mirror

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

  q-dialog(v-model="createMode" maximized no-route-dismiss)
    q-card(style="width:100vw; max-width:600px; overflow:hidden;")
      .centered.full-width
        CreateCard(
          show-back-btn
          @back="createMode = false"
          @created="addImage"
          style="padding-top:0px; min-width:300px; max-width:600px;"
          ref="createCard"
          :customModel="customModel"
          @active-tab="setActiveCreationsStore"
        ).full-width

  MagicMirrorDialog(v-model="showMMChoice")

</template>

<script lang="ts">
import { defineComponent, PropType, ref } from "vue"
import CreateCard from "components/CreateCard.vue"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import type { CreateImageRequest, CreateImageRequestData, CreateVideoRequest } from "fiddl-server/dist/lib/types/serverTypes"
import type { CreateImageRequestWithCustomModel } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { CustomModel } from "lib/api"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useQuasar } from "quasar"
import { match } from "ts-pattern"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import mediaViwer from "lib/mediaViewer"
import MediaGallery from "src/components/MediaGallery.vue"
import type { MediaGalleryMeta } from "src/types/media-gallery"
import { img, s3Video } from "lib/netlifyImg"
import type { MediaType, UnifiedRequest } from "lib/types"
import { useUserAuth } from "src/stores/userAuth"
import { useCreateContextStore } from "src/stores/createContextStore"
import MagicMirrorDialog from "src/components/MagicMirrorDialog.vue"
import { extractAspectRatioFromMeta, getCachedAspectRatio, parseAspectRatio as parseAspectRatioValue, rememberAspectRatio } from "src/lib/aspectRatio"
// Overlay Add-as-input handled inside MediaGallery when showUseAsInput is true
export default defineComponent({
  name: "PromptTab",
  components: {
    CreateCard,
    ImageRequestCard,
    MediaGallery,
    MagicMirrorDialog,
  },
  props: {
    customModel: {
      type: Object as PropType<CustomModel> | null,
      default: null,
      required: false,
    },
  },
  data() {
    return {
      img,
      quasar: useQuasar(),
      createImageStore: useCreateImageStore(),
      createVideoStore: useCreateVideoStore(),
      createMode: false,
      selectedRequest: null as UnifiedRequest | null,
      showRequest: false,
      gridMode: "mosaic" as "list" | "grid" | "mosaic",
      currentTab: "image" as MediaType,
      gridModeOptions: [
        { icon: "dashboard", value: "mosaic" },
        { icon: "grid_view", value: "grid" },
        { icon: "list", value: "list" },
      ],
      imageCreations: useImageCreations(),
      videoCreations: useVideoCreations(),
      createContext: useCreateContextStore(),
      suppressCreateModal: false,
      showMMChoice: false,
    }
  },
  computed: {
    showInitialLoading(): boolean {
      const store = this.activeCreationsStore
      const loading = !!store?.loadingCreations
      const empty = !Array.isArray(store?.creations) || store.creations.length === 0
      const notLoadedYet = !this.createContext?.state?.hasLoaded?.[this.currentTab]
      return empty && (loading || notLoadedYet)
    },
    galleryColsDesktop(): number {
      const screen = this.quasar?.screen
      if (!screen) return 6
      if (screen.gt.lg) return 8
      if (screen.gt.md) return 6
      if (screen.gt.sm) return 4
      return 3
    },
    galleryColsMobile(): number {
      const screen = this.quasar?.screen
      if (!screen) return 5
      if (screen.gt.sm) return 6
      if (screen.gt.xs) return 5
      return 3
    },
    gridThumbSizeDesktop(): number {
      return 120
    },
    gridThumbSizeMobile(): number {
      return 90
    },
    imageMediaObjects(): MediaGalleryMeta[] {
      const base = this.buildMediaGalleryItems(this.imageCreations.creations, "image")
      const pending = this.createImageStore.state.pendingPlaceholders || []
      if (!pending.length) return base
      const placeholders = pending.map((id: string) => ({
        id,
        url: img(id, "md"),
        type: "image" as MediaType,
        placeholder: true,
      }))
      return [...placeholders, ...base]
    },
    videoMediaObjects(): MediaGalleryMeta[] {
      return this.buildMediaGalleryItems(this.videoCreations.creations, "video")
    },
    allMediaObjects(): MediaGalleryMeta[] {
      return this.currentTab === "image" ? this.imageMediaObjects : this.videoMediaObjects
    },
    activeCreateStore() {
      return match(this.currentTab)
        .with("image", () => this.createImageStore)
        .with("video", () => this.createVideoStore)
        .run()
    },
    activeCreationsStore() {
      return match(this.currentTab)
        .with("image", () => this.imageCreations)
        .with("video", () => this.videoCreations)
        .run()
    },
    activeImageStore() {
      return this.currentTab === "image" ? this.imageCreations : null
    },
    activeVideoStore() {
      return this.currentTab === "video" ? this.videoCreations : null
    },
    dynamicModelOptions() {
      let modelName
      if (this.currentTab == "image") modelName = this.createImageStore.state.req.model
      else modelName = this.createVideoStore.state.req.model
      if (modelName == "custom") modelName = "custom: " + this.createImageStore.state.req.customModelName
      return [
        { label: "All", value: false },
        { label: modelName, value: true },
      ]
    },
    showModelFilter() {
      // Only show the model filter when in single-model mode.
      // For images, hide if randomizer is enabled (multi or random modes).
      if (this.currentTab === "image") return !this.createImageStore.state.randomizer.enabled
      return true
    },
  },
  watch: {
    "createImageStore.state.req.customModelId": {
      handler(val: string | undefined) {
        // React to changes in selected custom model while dynamic model filter is active
        if (this.currentTab !== "image") return
        if (!this.activeCreationsStore.dynamicModel) return
        if (val) {
          // Update store and reload creations for the newly selected custom model
          void this.imageCreations.setCustomModelId(val, useUserAuth().userId || undefined)
        } else {
          // Clear custom model filter if no model is selected
          void this.imageCreations.clearCustomModelId(useUserAuth().userId || undefined)
        }
      },
      immediate: false,
    },
    "activeCreateStore.state.req.model": {
      handler(val: any) {
        this.activeCreationsStore.filter.model = val as any
        if (!this.activeCreationsStore.dynamicModel) {
          this.activeCreationsStore.dynamicModel = true
        } else this.activeCreationsStore.searchCreations(this.$userAuth.userId)
      },
      immediate: false,
    },
    "$q.screen.lt.md"(val) {
      if (!this.suppressCreateModal) this.createMode = val
    },
    // Keep createMode in sync with shared Create Context so other flows can open it
    "createContext.state.createMode": {
      handler(val: boolean) {
        if (this.createMode !== val) this.createMode = val
      },
      immediate: false,
    },
    createMode(val: boolean) {
      if (this.createContext.state.createMode !== val) this.createContext.state.createMode = val
    },
    "activeCreationsStore.dynamicModel": {
      handler(val: boolean) {
        if (val) {
          this.activeCreationsStore.filter.model = this.activeCreateStore.state.req.model as any
          if (this.currentTab == "image") this.imageCreations.filter.customModelId = this.createImageStore.state.req.customModelId
        } else {
          this.activeCreationsStore.filter.model = undefined
          if (this.currentTab == "image") this.imageCreations.filter.customModelId = undefined
        }
        this.activeCreationsStore.searchCreations(this.$userAuth.userId)
      },
      immediate: false,
      deep: true,
    },

    gridMode(val) {
      // for (const creation of this.creationsStore.creations) {
      //   const card = this.$refs[creation.id] as InstanceType<typeof ImageRequestCard>[] | undefined
      //   if (card && card[0]) card[0].minimized.value = val
      // }
      this.createContext.setGridMode(this.gridMode)
    },
    customModel: {
      immediate: false,
      handler(val) {
        if (this.activeImageStore) {
          if (val) void this.activeImageStore.setCustomModelId(val.id, useUserAuth().userId || undefined)
          else void this.activeImageStore.clearCustomModelId(useUserAuth().userId || undefined)
        }
      },
    },
    "$userAuth.loggedIn": {
      immediate: false,
      handler(val) {
        if (!val) {
          this.imageCreations.reset()
          this.videoCreations.reset()
          this.createContext.setHasLoaded("image", false)
          this.createContext.setHasLoaded("video", false)
          return
        }

        this.maybeLoadTab(this.currentTab, { force: true })
        this.maybePrefetchOppositeTab()
      },
    },
  },
  async mounted() {
    this.suppressCreateModal = new URLSearchParams(window.location.search).has("noCreateModal")
    if (this.quasar.screen.lt.md && !this.suppressCreateModal) this.createMode = true
    void this.$nextTick(() => {
      this.gridMode = this.createContext.state.gridMode
      this.maybeLoadTab(this.currentTab)
      this.maybePrefetchOppositeTab()
    })
  },
  methods: {
    showDetailsBySelect(payload: { id: string; type: "image" | "video" }) {
      const displayObjects = this.allMediaObjects as MediaGalleryMeta[]
      if (!Array.isArray(displayObjects) || !displayObjects.length) return
      if (!payload?.id) return

      // Build viewer list excluding placeholders, preserving visual order
      const viewerObjects = displayObjects.filter((o) => !(typeof o.id === "string" && o.id.startsWith("pending-")))
      if ((mediaViwer as any).showById) void (mediaViwer as any).showById(viewerObjects, payload.id)
      else {
        const startIndex = viewerObjects.findIndex((o) => o.id === payload.id)
        if (startIndex < 0) return
        void mediaViwer.show(viewerObjects, startIndex)
      }
    },
    buildMediaGalleryItems(creations: UnifiedRequest[], mediaType: MediaType): MediaGalleryMeta[] {
      if (!Array.isArray(creations) || creations.length === 0) return []
      const sorted = [...creations].sort((a, b) => {
        const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime()
        const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime()
        return bt - at
      })

      return sorted.flatMap((req) => {
        const ids = Array.isArray(req.mediaIds) ? req.mediaIds : []
        return ids.map((id) => {
          const isImage = mediaType === "image"
          const base = isImage ? { id, url: img(id, "md"), type: "image" as MediaType } : ({ id, url: s3Video(id, "preview-sm"), type: "video" as MediaType } as const)

          const mediaList = isImage ? (req as any).images : (req as any).videos
          const nsfw = Array.isArray(mediaList) ? mediaList.find((entry: any) => entry.id === id)?.nsfw : undefined

          return {
            ...base,
            requestId: req.id,
            requestType: (req.type as MediaType | undefined) || mediaType,
            isPublic: req.public,
            requestQuantity: req.quantity,
            aspectRatio: this.resolveAspectRatio(req, id),
            nsfw,
          }
        })
      })
    },
    resolveAspectRatio(req: UnifiedRequest, mediaId: string): number | undefined {
      const direct = parseAspectRatioValue(req.aspectRatio)
      if (typeof direct === "number") {
        rememberAspectRatio(mediaId, direct)
        return direct
      }

      const meta = (req as unknown as { meta?: unknown }).meta
      const metaRatio = extractAspectRatioFromMeta(meta)
      if (typeof metaRatio === "number") {
        rememberAspectRatio(mediaId, metaRatio)
        return metaRatio
      }

      const cached = getCachedAspectRatio(mediaId)
      if (typeof cached === "number") return cached

      return undefined
    },
    isImageCreations(store: any): store is ReturnType<typeof useImageCreations> {
      return "filter" in store && "customModelId" in store.filter
    },
    setActiveCreationsStore(activeTab: "image" | "video") {
      this.currentTab = activeTab
      this.createContext.setActiveTab(activeTab)
      this.maybeLoadTab(activeTab)
      this.maybePrefetchOppositeTab()
    },
    maybeLoadTab(tab: MediaType, options: { force?: boolean } = {}) {
      if (!this.$userAuth?.loggedIn) return
      const userId = this.$userAuth.userId
      if (!userId) return

      const store = tab === "image" ? this.imageCreations : this.videoCreations
      const { force = false } = options
      if (store.loadingCreations) return
      const hasItems = Array.isArray(store.creations) && store.creations.length > 0
      if (!force && hasItems) {
        if (!this.createContext.state.hasLoaded[tab]) this.createContext.setHasLoaded(tab, true)
        return
      }

      if (force) store.searchCreations(userId)
      else void store.loadCreations(userId)

      if (!this.createContext.state.hasLoaded[tab]) this.createContext.setHasLoaded(tab, true)
    },
    maybePrefetchOppositeTab() {
      const otherTab: MediaType = this.currentTab === "image" ? "video" : "image"
      if (this.createContext.state.hasLoaded[otherTab]) return
      this.maybeLoadTab(otherTab)
    },
    showDetails(imageIndex: number) {
      // Use the exact list and ordering shown in the gallery
      const displayObjects = this.allMediaObjects as MediaGalleryMeta[]
      if (!Array.isArray(displayObjects) || !displayObjects.length) return

      const clicked = displayObjects[imageIndex]
      if (!clicked) return

      // Ignore clicks on placeholders (pending tiles)
      if (typeof clicked.id === "string" && clicked.id.startsWith("pending-")) return

      // Build viewer list excluding placeholders, preserving visual order
      const viewerObjects = displayObjects.filter((o) => !(typeof o.id === "string" && o.id.startsWith("pending-")))

      // Prefer id-based viewer focus to avoid index drift
      if ((mediaViwer as any).showById) void (mediaViwer as any).showById(viewerObjects, clicked.id)
      else {
        const startIndex = viewerObjects.findIndex((o) => o.id === clicked.id)
        if (startIndex < 0) return
        void mediaViwer.show(viewerObjects, startIndex)
      }
    },
    setReq(request: Partial<CreateImageRequest | CreateVideoRequest>, toggleCreateMode = false) {
      if (toggleCreateMode) this.createMode = true
      void this.$nextTick(() => {
        // console.log("createCard setReq Triggered", createCard)
        // if(request.)
        this.activeCreateStore.setReq(request as any)
      })
    },
    addImage(data: string) {
      if (this.createMode) this.createMode = false
      console.log(data)
      const latestCreation = this.activeCreationsStore.creations[0]
      if (!latestCreation) return
      console.log(latestCreation)
      // if (this.gridMode) this.showDetails(latestCreation.id)
    },
    // no-op: useAsInput handled internally by MediaGallery now when showUseAsInput is true
    handleModelSelect(payload: { model: string; customModelId?: string | null; customModelName?: string | null; mediaId: string; mediaType: MediaType }) {
      if (!payload?.model) return

      if (payload.mediaType === "video") {
        if (this.currentTab !== "video") this.currentTab = "video"
        this.createVideoStore.setReq({ model: payload.model as any })
        return
      }

      if (this.currentTab !== "image") this.currentTab = "image"

      const randomizer = this.createImageStore.state.randomizer
      if (randomizer?.enabled) {
        randomizer.enabled = false
        // leave other randomizer fields untouched; disabled state ignores them
      }

      const updates: Partial<CreateImageRequestWithCustomModel> = {
        model: payload.model as any,
      }

      if (payload.model === "custom") {
        updates.customModelId = payload.customModelId ?? undefined
        if (payload.customModelName) updates.customModelName = payload.customModelName
      } else {
        updates.customModelId = undefined
        updates.customModelName = undefined
      }

      this.createImageStore.setReq(updates)
    },
  },
})
</script>

<style scoped>
/* Smooth list transitions */
.fade-list-enter-active,
.fade-list-leave-active,
.fade-list-move {
  transition: all 180ms ease;
}
.fade-list-enter-from,
.fade-list-leave-to {
  opacity: 0.01;
  transform: translateY(6px);
}
</style>
