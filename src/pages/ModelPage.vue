<template lang="pug">
q-page.full-width
  .centered.q-mt-lg
    ModelCard(v-if="currentModel" :model="currentModel" style="width:700px;")
  .centered.q-mt-lg
    .row.items-center.justify-center.cursor-pointer(v-if="creatorMeta" @click="$router.push({ name: 'profile', params: { username: creatorMeta.userName } })")
      q-img.q-mr-md(
        :src="avatarImg(creatorMeta.id)"
        placeholder-src="/blankAvatar.webp"
        style="width:40px; height:40px; border-radius:50%;"
      )
      .column
        small Created by
        .row.items-center
          a.text-h5.q-mr-sm(
            v-if="creatorMeta.userName"
            :href="`/profile/${creatorMeta.userName}`"
            @click.prevent="$router.push({ name: 'profile', params: { username: creatorMeta.userName } })"
            style="cursor: pointer; font-weight: 400; text-decoration: none; color: white;"
          ) @{{ creatorMeta.userName }}
    q-btn.q-ml-md(label="All Models" color="accent" @click="$router.push({name:'models'})" outline icon="arrow_left")
    q-btn.q-ml-md(label="Create with this model" color="primary" @click="createWithModel()" icon="fa-solid fa-wand-magic-sparkles")
  .q-ma-md
    .centered
      q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
    .centered.q-mt-md
      MediaGallery.q-pl-md.q-pr-md(
        :mediaObjects="allMediaObjects"
        :layout="galleryLayout"
        :rowHeightRatio="1"
        gap="8px"
        :cols-desktop="gridMode === 'mosaic' ? 8 : 5"
        :thumb-size-desktop="gridMode === 'mosaic' ? 200 : 190"
        selectable
        @selected-index="showDetails"
      )
    .centered.q-ma-md(v-if="imageCreations.creations.length > 9")
      q-btn(
        label="Load More"
        @click="imageCreations.loadCreations()"
        :disable="imageCreations.creations.length < 1"
      )
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import MediaGallery, { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import ModelCard from "src/components/ModelCard.vue"
import { models } from "src/stores/modelsStore"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import { img, s3Video, avatarImg } from "lib/netlifyImg"
import { userGetUsername } from "lib/orval"
import { ImageModel, imageModels, VideoModel, videoModels } from "lib/imageModels"
import mediaViwer from "lib/mediaViewer"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useCreateVideoStore } from "src/stores/createVideoStore"

export default defineComponent({
  name: "ModelPage",
  components: {
    MediaGallery,
    ModelCard,
    ImageRequestCard,
  },
  setup() {
    const route = useRoute()
    const imageCreations = useImageCreations()
    const videoCreations = useVideoCreations()
    const showRequest = ref(false)
    // Use union type for selectedRequest to allow CreationImage or null
    const selectedRequest = ref<null | any>(null)
    const gridMode = ref("mosaic")
    const gridModeOptions = [
      { icon: "dashboard", value: "mosaic" },
      { icon: "grid_view", value: "grid" },
    ]
    // Use only route params for modelName and customModelId
    const modelName = computed(() => getStringParam(route.params.modelName))
    const customModelId = computed(() => getStringParam(route.params.customModelId))
    // Creator meta for custom models
    const creatorMeta = ref<{ id: string; userName: string } | null>(null)

    // Find the current model object for ModelCard
    const currentModel = computed(() => {
      if (customModelId.value) {
        return models.custom.find((m) => m.id === customModelId.value)
      } else if (modelName.value) {
        return models.base.find((m) => m.slug === modelName.value)
      }
      return undefined
    })

    watch(
      currentModel,
      async (model) => {
        if (model && "creatorId" in model && model.creatorId) {
          // Only for custom models
          try {
            const usernameResponse = await userGetUsername({ userId: String(model.creatorId) })
            creatorMeta.value = { id: model.creatorId as string, userName: typeof usernameResponse.data === "string" ? usernameResponse.data : "" } as { id: string; userName: string }
          } catch (e) {
            creatorMeta.value = { id: model.creatorId as string, userName: "" } as { id: string; userName: string }
          }
        } else {
          creatorMeta.value = null
        }
      },
      { immediate: true },
    )

    // Get model info from route params or query
    // Only allow string, not array or undefined
    function getStringParam(val: unknown): string | undefined {
      if (typeof val === "string") return val
      return undefined
    }

    // Determine if this is an image or video model
    const isVideoModel = computed(() => {
      if (customModelId.value) return false // custom models are always images
      return modelName.value ? videoModels.includes(modelName.value as any) : false
    })
    const isImageModel = computed(() => !isVideoModel.value)

    // Set up filtering for the model
    // Watch and filter the correct store
    watch(
      [modelName, customModelId, isVideoModel],
      ([name, customId, isVideo]) => {
        if (isVideo) {
          // Video model
          videoCreations.filter.model = name && videoModels.includes(name as any) ? (name as any) : undefined
          videoCreations.searchCreations()
        } else {
          // Image model (including custom)
          if (customId) {
            imageCreations.filter.model = "custom"
            imageCreations.filter.customModelId = customId
          } else if (name) {
            if (imageModels.includes(name as any)) {
              imageCreations.filter.model = name as any
            } else {
              imageCreations.filter.model = undefined
            }
            imageCreations.filter.customModelId = undefined
          }
          imageCreations.searchCreations()
        }
      },
      { immediate: true },
    )

    const allMediaObjects = computed<MediaGalleryMeta[]>(() => {
      if (isVideoModel.value) {
        // Video: flatten all video IDs from all creations
        return videoCreations.allCreations.map((el) => ({
          id: el.id,
          url: s3Video(el.id, "preview-lg"),
          type: "video",
        }))
      } else {
        // Image
        return imageCreations.allCreations.map((el) => ({
          id: el.id,
          url: img(el.id, "md"),
          type: "image",
        }))
      }
    })

    const galleryLayout = computed<"grid" | "mosaic">(() => (gridMode.value === "mosaic" ? "mosaic" : "grid"))

    function showDetails(mediaIndex: number) {
      // For both images and videos, open MediaViewer dialog like PromptTab/BrowserPage
      void mediaViwer.show(allMediaObjects.value, mediaIndex)
    }
    const router = useRouter()
    function createWithModel() {
      if (isImageModel.value) {
        const model = customModelId.value ? "custom" : (currentModel.value?.slug as ImageModel) || ("core" as ImageModel)
        useCreateImageStore().setReq({ model, customModelId: model == "custom" ? customModelId.value : undefined, customModelName: model == "custom" ? currentModel.value?.name : undefined })
        void router.push({ name: "create", params: { activeTab: "image" } })
      } else {
        // Video model
        useCreateVideoStore().setReq({ model: (currentModel.value?.slug as VideoModel) || "veo-2" })
        void router.push({ name: "create", params: { activeTab: "video" } })
      }
    }

    return { createWithModel, imageCreations, videoCreations, modelName, customModelId, gridMode, gridModeOptions, allMediaObjects, showRequest, selectedRequest, showDetails, isVideoModel, isImageModel, galleryLayout, currentModel, creatorMeta, avatarImg }
  },
})
</script>
