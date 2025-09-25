<template lang="pug">
.centered.full-height.full-width
  .full-width
    .row.full-height.full-width.no-wrap
      .col-auto.q-ml-md( v-if="quasar.screen.gt.sm")
        .centered(style="width:450px; padding:0px;")
          CreateCard.q-mt-md.full-width(
            @created="addImage"
            style="padding-top:0px; min-width:300px; max-width:600px;"
            ref="createCard"
            :customModel="customModel"
            @active-tab="setActiveCreationsStore"
          )
      .col-grow.q-mr-sm.full-height
        q-scroll-area.full-width(:style="quasar.screen.gt.sm ? 'height:calc(100vh - 60px); height:calc(100dvh - 60px);' : 'height:calc(100vh - 110px); height:calc(100dvh - 110px);'")
          .full-width(style="height:15px;").gt-sm
          .full-width.relative-position
            .full-width(style="height:55px;")
              q-card.q-pa-sm.fixed-top.blur-bg(style="z-index:100; margin:6px;")
                .row.q-gutter-md.items-center.no-wrap
                  q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
                  q-separator(vertical)
                  q-btn-toggle(v-if="showModelFilter" v-model="activeCreationsStore.dynamicModel" :options="dynamicModelOptions" size="sm" flat)
                  .col-grow
                  q-btn.gt-sm(label="Magic Mirror" color="primary" rounded @click="showMMChoice = true")

            .centered
              div(v-if="gridMode == 'list'" v-for="creation in activeCreationsStore.creations"  :key="creation.id").full-width.q-pr-md.q-pl-md
                ImageRequestCard(:creation="creation")
              MediaGallery.q-pl-md.q-pr-md(
                v-else-if="gridMode == 'mosaic'"
                @selected-index="showDetails"
                selectable
                :mediaObjects="allMediaObjects"
                layout="mosaic"
                :rowHeightRatio="1.2"
                :show-loading="false"
                gap="8px"
                :cols-desktop="8"
                :thumb-size-desktop="90"
                :cols-mobile="3"
                :thumb-size-mobile="60"
                :disable-nsfw-mask="true"
                :show-visibility-toggle="true"
                :show-delete-button="true"
              )
                template(#actions="{ media }")
                  // Show only for image items and when not placeholder
                  .actions-slot(v-if="currentTab==='image' && !media.placeholder")
                    q-btn(flat dense round icon="add_photo_alternate" color="white" :loading="addInputLoading[media.id] === true" :disable="addInputLoading[media.id] === true" @click.stop="useAsInput(media.id)")
              MediaGallery.q-pl-md.q-pr-md(
                v-else-if="gridMode == 'grid'"
                @selected-index="showDetails"
                selectable
                :cols-desktop="5"
                :thumb-size-desktop="190"
                :rowHeightRatio="1"
                layout="grid"
                :mediaObjects="allMediaObjects"
                :disable-nsfw-mask="true"
                :show-visibility-toggle="true"
                :show-delete-button="true"
              )
                template(#actions="{ media }")
                  .actions-slot(v-if="currentTab==='image' && !media.placeholder")
                    q-btn(flat dense round icon="add_photo_alternate" color="white" :loading="addInputLoading[media.id] === true" :disable="addInputLoading[media.id] === true" @click.stop="useAsInput(media.id)")
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
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { CustomModel } from "lib/api"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useQuasar } from "quasar"
import { match } from "ts-pattern"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import mediaViwer from "lib/mediaViewer"
import MediaGallery, { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { img, s3Video } from "lib/netlifyImg"
import type { MediaType, UnifiedRequest } from "lib/types"
import { useUserAuth } from "src/stores/userAuth"
import { useCreateContextStore } from "src/stores/createContextStore"
import MagicMirrorDialog from "src/components/MagicMirrorDialog.vue"
import { Dialog } from "quasar"
import InputImageQuickEdit from "src/components/dialogs/InputImageQuickEdit.vue"
import { hdUrl } from "lib/imageCdn"
import { createUploadImage } from "lib/orval"
import { uploadToPresignedPost } from "lib/api"
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
      addInputLoading: {} as Record<string, boolean>,
    }
  },
  computed: {
    allMediaObjects() {
      const isImage = this.currentTab === "image"
      // Sort requests newest-first, then flatten to mediaIds
      const sorted = [...this.activeCreationsStore.creations].sort((a, b) => {
        const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime()
        const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime()
        return bt - at
      })
      const data = sorted.flatMap((req) =>
        req.mediaIds.map((id) => {
          const base = isImage ? { id, url: img(id, "md"), type: "image" as MediaType } : ({ id, url: s3Video(id, "preview-sm"), type: "video" as MediaType } as const)

          // Derive a numeric aspect ratio from the request (e.g. "16:9" -> 16/9)
          const raw = req.aspectRatio as string | undefined
          let ar: number | undefined
          if (raw) {
            if (raw.includes(":")) {
              const parts = raw.split(":").map((x) => parseFloat(x))
              const w = parts[0]
              const h = parts[1]
              ar = h && w ? w / h : undefined
            } else {
              const n = parseFloat(raw)
              ar = Number.isFinite(n) ? n : undefined
            }
          }

          const mediaList = isImage ? (req as any).images : (req as any).videos
          const nsfw = Array.isArray(mediaList) ? mediaList.find((entry: any) => entry.id === id)?.nsfw : undefined

          return {
            ...base,
            requestId: req.id,
            requestType: req.type,
            isPublic: req.public,
            requestQuantity: req.quantity,
            aspectRatio: ar,
            nsfw,
          }
        }),
      )

      // While an image batch is rendering, show placeholder tiles at the front
      if (isImage) {
        const pending = this.createImageStore.state.pendingPlaceholders || []
        if (pending.length) {
          const placeholders = pending.map((id: string) => ({
            id,
            url: img(id, "md"),
            type: "image" as MediaType,
            placeholder: true,
          }))
          return [...placeholders, ...data]
        }
      }

      return data
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
      handler(val: string) {
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
        console.log("activeCreationsStore.dynamicModel toggled", val)
        if (val) {
          this.activeCreationsStore.filter.model = this.activeCreateStore.state.req.model
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
        if (val) void this.activeCreationsStore.loadCreations(this.$userAuth.userId)
        else {
          this.imageCreations.reset()
          this.videoCreations.reset()
        }
      },
    },
  },
  async mounted() {
    this.suppressCreateModal = new URLSearchParams(window.location.search).has("noCreateModal")
    if (this.quasar.screen.lt.md && !this.suppressCreateModal) this.createMode = true
    void this.$nextTick(() => {
      this.gridMode = this.createContext.state.gridMode
    })
  },
  methods: {
    isImageCreations(store: any): store is ReturnType<typeof useImageCreations> {
      return "filter" in store && "customModelId" in store.filter
    },
    setActiveCreationsStore(activeTab: "image" | "video") {
      this.currentTab = activeTab
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
      const startIndex = viewerObjects.findIndex((o) => o.id === clicked.id)
      if (startIndex < 0) return

      void mediaViwer.show(viewerObjects, startIndex)
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
    async useAsInput(imageId: string) {
      try {
        if (this.currentTab !== 'image') return
        if (!imageId || typeof imageId !== 'string' || imageId.startsWith('pending-')) return
        this.addInputLoading[imageId] = true
        // Fetch HD image and upload as a new input image
        const url = await hdUrl(imageId)
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('Failed to fetch HD image')
        const blob = await resp.blob()
        const file = new File([blob], 'input.webp', { type: 'image/webp' })
        const { data } = await createUploadImage({ fileType: 'image/webp' })
        await uploadToPresignedPost({ file, presignedPost: data.uploadUrl })

        // Apply to create store and default to nano-banana
        this.createImageStore.setReq({ uploadedStartImageIds: [data.imageId], model: 'nano-banana' } as any)

        // Open quick edit dialog directly
        Dialog.create({ component: InputImageQuickEdit, componentProps: { imageId: data.imageId } })
      } catch (e) {
        console.error(e)
        this.$q.notify({ type: 'negative', message: 'Unable to add image as input' })
      } finally {
        this.addInputLoading[imageId] = false
      }
    },
  },
})
</script>
