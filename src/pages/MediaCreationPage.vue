<template lang="pug">
q-page
  .q-pa-lg
    div(v-if="loading")
      .centered.q-my-xl
        q-spinner(color="primary" size="32px")
    q-banner.bg-negative.text-white(v-else-if="error") {{ error }}
    template(v-else-if="creation")
      ImageRequestCard(
        :creation="creation"
        :creatorUsername="creatorUsername || ''"
        hideLinkBtn
        @reload="onReload"
        @deleted="onDeleted"
      )
      div(v-if="creatorUsername")
        p.q-mb-xs Author
        .row.q-gutter-md.items-center.cursor-pointer.q-pa-sm.bg-grey-10(
          style="border-radius: 10px;"
          @click="goToCreatorProfile"
        )
          q-img(:src="avatarImg(creation.creatorId)" style="width: 50px; height: 50px; border-radius: 50%;").q-mt-md
          h6 @{{ creatorUsername }}
    q-banner.bg-grey-9.text-white(v-else) Media not found.
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import mediaViwer from "lib/mediaViewer"
import type { MediaGalleryMeta } from "src/types/media-gallery"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import { creationsGetCreationData, userGetUsername } from "src/lib/orval"
import { avatarImg } from "lib/netlifyImg"
import { getCreationRequest } from "lib/util"
import type { MediaType, UnifiedRequest } from "lib/types"

const route = useRoute()
const router = useRouter()

const creation = ref<UnifiedRequest | null>(null)
const creatorUsername = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const viewerKey = ref<string | null>(null)

const mediaId = computed(() => (typeof route.params.mediaId === "string" ? route.params.mediaId : null))
const mediaType = computed<MediaType>(() => (route.name === "videoMedia" ? "video" : "image"))
const commentId = computed(() => {
  const raw = route.query.commentId
  return typeof raw === "string" && raw.length > 0 ? raw : null
})

interface LoadOptions {
  autoOpenViewer?: boolean
}

async function loadCreation(options: LoadOptions = {}) {
  const autoOpenViewer = options.autoOpenViewer ?? true
  const id = mediaId.value
  if (!id) {
    creation.value = null
    creatorUsername.value = null
    error.value = "Invalid media link."
    return
  }

  loading.value = true
  error.value = null
  const type = mediaType.value

  try {
    const params = type === "image" ? { imageId: id } : { videoId: id }
    const { data } = await creationsGetCreationData(params)
    if (!data) {
      creation.value = null
      creatorUsername.value = null
      error.value = "Creation not found."
      return
    }

    const request = await getCreationRequest(data.requestId, type)
    creation.value = request
    viewerKey.value = null

    try {
      const userResponse = await userGetUsername({ userId: request.creatorId })
      creatorUsername.value = userResponse?.data ?? null
    } catch (usernameError) {
      console.error("[MediaCreationPage] failed to load creator username", usernameError)
      creatorUsername.value = null
    }

    if (autoOpenViewer) {
      openViewer(request, id, commentId.value)
    }
  } catch (err) {
    console.error("[MediaCreationPage] failed to load creation", err)
    creation.value = null
    creatorUsername.value = null
    error.value = "Unable to load creation."
  } finally {
    loading.value = false
  }
}

function openViewer(request: UnifiedRequest, targetMediaId: string, initialCommentId: string | null) {
  if (!request.mediaIds.length) return
  const mediaList = request.type === "image" ? (request as any).images : (request as any).videos
  const mediaObjects: MediaGalleryMeta[] = request.mediaIds.map((id) => {
    const nsfw = Array.isArray(mediaList) ? mediaList.find((entry: any) => entry.id === id)?.nsfw : undefined
    return {
      id,
      type: request.type,
      requestId: request.id,
      requestType: request.type,
      nsfw,
    }
  })
  const startIndex = Math.max(request.mediaIds.findIndex((id) => id === targetMediaId), 0)
  const key = `${request.id}:${targetMediaId}:${initialCommentId ?? ""}`
  if (viewerKey.value === key) return
  viewerKey.value = key
  void mediaViwer.show(mediaObjects, startIndex, true, {
    requestId: request.id,
    initialCommentId: initialCommentId ?? undefined,
  })
}

function onReload() {
  void loadCreation({ autoOpenViewer: false })
}

function onDeleted() {
  void router.push({ name: "browse" })
}

function goToCreatorProfile() {
  if (!creatorUsername.value) return
  void router.push({ name: "profile", params: { username: creatorUsername.value } })
}

onMounted(() => {
  void loadCreation()
})

watch(
  () => [mediaId.value, mediaType.value],
  ([newId, newType], [oldId, oldType]) => {
    if (!newId) return
    if (newId === (oldId as string | null) && newType === (oldType as MediaType | undefined)) return
    void loadCreation()
  },
)

watch(
  () => commentId.value,
  (newComment, oldComment) => {
    if (newComment === oldComment) return
    if (!creation.value) return
    if (!mediaId.value) return
    openViewer(creation.value, mediaId.value, newComment)
  },
)
</script>

<style scoped>
.centered {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
