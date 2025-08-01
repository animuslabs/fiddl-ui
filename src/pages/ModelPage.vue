<template lang="pug">
q-page.full-width.position-relative
  .centered.q-mt-lg.q-mb-md
    ModelCard(v-if="currentModel" :model="currentModel" style="width: 500px;")
  .centered.z-top.bg-blur.q-pa-sm(style="position: sticky; top: 50px;")
    .row.items-center.q-gutter-md.q-pr-md.cursor-pointer(v-if="creatorMeta" style="border-radius: 12px;" @click="router.push({ name: 'profile', params: { username: creatorMeta.userName } })")
      q-img(
        :src="avatarImg(creatorMeta.id)"
        placeholder-src="/blankAvatar.webp"
        style="width:40px; height:40px; border-radius:50%;"
      )
      div
        small Created by
        .row.items-center.q-gutter-md
          a.text-h5.q-mr-sm(
            v-if="creatorMeta.userName"
            :href="`/profile/${creatorMeta.userName}`"
            @click.prevent="router.push({ name: 'profile', params: { username: creatorMeta.userName } })"
            style="cursor: pointer; font-weight: 400; text-decoration: none; color: white;"
          ) @{{ creatorMeta.userName }}
    .row.q-gutter-md
      q-btn(label="All Models" color="secondary" @click="router.push({name:'models'})" outline icon="arrow_left" padding="10px")
      q-btn(label="Create with this model" color="primary" @click="createWithModel" icon="fa-solid fa-wand-magic-sparkles" padding="10px")

  .q-ma-md
    .centered
      q-btn-toggle(v-model="gridMode" :options="gridModeOptions" size="sm" flat)
    .centered.q-mt-md
      MediaGallery.q-pl-md.q-pr-md(
        :mediaObjects="allMediaObjects"
        :layout="gridMode === 'mosaic' ? 'mosaic' : 'grid'"
        :rowHeightRatio="1"
        gap="8px"
        :cols-desktop="gridMode === 'mosaic' ? 8 : 5"
        :thumb-size-desktop="gridMode === 'mosaic' ? 200 : 190"
        selectable
        @selected-index="showDetails"
      )
    .centered.q-ma-md(v-if="imageCreations.creations.length > 9 && isImageModel")
      q-btn(
        label="Load More"
        @click="imageCreations.loadCreations(true)"
        :disable="imageCreations.creations.length < 1"
      )
</template>

<script setup lang="ts">
import { ref, computed, watch, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import MediaGallery, { type MediaGalleryMeta } from "src/components/MediaGallery.vue"
import ModelCard from "src/components/ModelCard.vue"
import { models } from "src/stores/modelsStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { img, s3Video, avatarImg } from "lib/netlifyImg"
import { userGetUsername } from "lib/orval"
import { type ImageModel, imageModels, type VideoModel, videoModels } from "lib/imageModels"
import mediaViwer from "lib/mediaViewer"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useCreateVideoStore } from "src/stores/createVideoStore"

defineOptions({ name: "ModelPage" })

const route = useRoute()
const router = useRouter()

const imageCreations = useImageCreations()
const videoCreations = useVideoCreations()

const gridMode = ref<"mosaic" | "grid">("mosaic")
const gridModeOptions = [
  { icon: "dashboard", value: "mosaic" },
  { icon: "grid_view", value: "grid" },
]

const getStringParam = (v: unknown) => (typeof v === "string" ? v : undefined)
const modelName = computed(() => getStringParam(route.params.modelName))
const customModelId = computed(() => getStringParam(route.params.customModelId))

const currentModel = computed(() => {
  if (customModelId.value) return models.custom.find((m) => m.id === customModelId.value)
  if (modelName.value) return models.base.find((m) => m.slug === modelName.value)
  return undefined
})

type CreatorMeta = { id: string; userName: string }
const creatorMeta = shallowRef<CreatorMeta | null>(null)

watch(
  currentModel,
  async (m) => {
    if (m && "creatorId" in m && m.creatorId) {
      try {
        const { data } = await userGetUsername({ userId: String(m.creatorId) })
        creatorMeta.value = { id: m.creatorId as string, userName: typeof data === "string" ? data : "" }
      } catch {
        creatorMeta.value = { id: m.creatorId as string, userName: "" }
      }
    } else {
      creatorMeta.value = null
    }
  },
  { immediate: true },
)

const isVideoModel = computed(() => {
  if (customModelId.value) return false
  return modelName.value ? (videoModels as readonly string[]).includes(modelName.value) : false
})
const isImageModel = computed(() => !isVideoModel.value)

watch(
  [modelName, customModelId, isVideoModel],
  ([name, customId, isVideo]) => {
    if (isVideo) {
      // Handle video model changes
      videoCreations.filter.model = name && (videoModels as readonly string[]).includes(name) ? (name as VideoModel) : undefined
      videoCreations.searchCreations(true)
    } else {
      // Handle image model (including custom) changes
      if (customId) {
        imageCreations.filter.model = "custom"
        imageCreations.filter.customModelId = customId
      } else {
        imageCreations.filter.model = name && (imageModels as readonly string[]).includes(name) ? (name as ImageModel) : undefined
        imageCreations.filter.customModelId = undefined
      }
      imageCreations.searchCreations(true)
    }
  },
  { immediate: true },
)

const allMediaObjects = computed<MediaGalleryMeta[]>(() =>
  isVideoModel.value ? videoCreations.allCreations.map((el) => ({ id: el.id, url: s3Video(el.id, "preview-md"), type: "video" })) : imageCreations.allCreations.map((el) => ({ id: el.id, url: img(el.id, "md"), type: "image" })),
)

function showDetails(idx: number) {
  void mediaViwer.show(allMediaObjects.value, idx)
}

function createWithModel() {
  if (isImageModel.value) {
    const model = customModelId.value ? "custom" : (currentModel.value?.slug as ImageModel) || "core"
    useCreateImageStore().setReq({
      model,
      customModelId: model === "custom" ? customModelId.value : undefined,
      customModelName: model === "custom" ? currentModel.value?.name : undefined,
    })
    void router.push({ name: "create", params: { activeTab: "image" } })
  } else {
    useCreateVideoStore().setReq({ model: (currentModel.value?.slug as VideoModel) || "veo-2" })
    void router.push({ name: "create", params: { activeTab: "video" } })
  }
}
</script>
