<template lang="pug">
.centered.q-mb-md.q-mt-lg.relative-position.items-center(:style="{visibility: downloadMode ? 'hidden' : 'visible'}")
  div.relative-position
    q-btn(
      icon="share"
      round
      flat
      color="grey-5"
      @click.stop="shareMenuOpen = true"
    )
      q-menu(
        v-if="shareMenuOpen"
        anchor="bottom left"
        self="top left"
        @click.stop="shareMenuOpen = false"
      )
        q-list
          q-item(clickable @click.stop="mobileShare()" v-close-popup)
            q-item-section
              .row.items-center
                q-icon(:name="mediaViewerStore.currentMediaType==='image'?'image':'smart_display'" size="20px").q-mr-md
                div Share Creation
          q-item(clickable @click="share()" v-close-popup)
            q-item-section
              .row.items-center
                q-icon(name="content_copy" size="20px").q-mr-md
                div Copy Link

  q-btn(
    icon="sym_o_info"
    flat
    round
    @click.stop="showRequestInfoDialog()"
    color="grey-5"
    v-if="mediaViewerStore.loadedRequestId"
  )

  q-btn(
    icon="chat_bubble"
    flat
    round
    color="grey-5"
    @click.stop="showCommentsDialog()"
  )
  span.count(v-if="popularity.get(mediaViewerStore.currentMediaId)?.commentsCount") {{ popularity.get(mediaViewerStore.currentMediaId)?.commentsCount ?? 0 }}

  div
    q-btn(
      icon="download"
      flat
      @click.stop="showDownloadWindow()"
      round
      :class="mediaViewerStore.downloadClass"
    )
      q-tooltip
        p(v-if="mediaViewerStore.userOwnsMedia") Download full resolution original and upscaled versions
        p(v-else).text-capitalize Download {{ mediaViewerStore.currentMediaType }}

  q-btn(
    icon="edit"
    flat
    round
    @click.stop="editMedia()"
    :color="mediaViewerStore.editBtnColor"
  )

  q-btn(
    icon="favorite"
    flat
    round
    @click.stop="toggleFavorite()"
    :color="popularity.get(mediaViewerStore.currentMediaId)?.isFavoritedByMe ? 'red-5' : 'grey-5'"
  )
  span.count(v-if="popularity.get(mediaViewerStore.currentMediaId)?.favorites") {{ popularity.get(mediaViewerStore.currentMediaId)?.favorites ?? 0 }}
  q-btn(
    flat
    round
    :icon="popularity.get(mediaViewerStore.currentMediaId)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'"
    v-if="currentIsPublic !== false"
    @click.stop="onUpvote()"
  )
  span.count(v-if="popularity.get(mediaViewerStore.currentMediaId)?.upvotes") {{ popularity.get(mediaViewerStore.currentMediaId)?.upvotes ?? 0 }}

  div.relative-position
    q-btn(
      icon="more_vert"
      round
      flat
      color="grey-5"
      @click.stop="moreMenuOpen = true"
    )
      q-menu(
        v-if="moreMenuOpen"
        anchor="bottom right"
        self="top right"
        @click.stop="moreMenuOpen = false"
      )
        q-list
          q-item(
            v-if="mediaViewerStore.currentMediaType==='image'"
            clickable
            @click="setProfileImage()"
            v-close-popup
          )
            q-item-section
              .row.items-center
                q-icon(name="account_circle" size="20px").q-mr-md
                div Use as Profile Image
          q-item(
            clickable
            @click="deleteMedia()"
            v-close-popup
            v-if="userCreatedImage && allowDelete"
          )
            q-item-section
              .row.items-center
                q-icon(name="delete" size="20px").q-mr-md
                div Delete

  div
    q-btn(
      icon="close"
      flat
      @click.stop="$emit('close')"
      round
      color="grey-5"
    )
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue"
import { Dialog } from "quasar"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { useUserAuth } from "src/stores/userAuth"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { useBrowserStore } from "src/stores/browserStore"
import { creationsDeleteMedia, creationsGetCreationData } from "src/lib/orval"
import { catchErr, copyToClipboard, getCreationRequest, longIdToShort, shareMedia, shareLink } from "src/lib/util"
import { COMMENT_DIALOG_SENTINEL } from "lib/mediaViewer"
import DownloadMedia from "./DownloadMedia.vue"
import CreateAvatar from "./CreateAvatar.vue"
import EditMedia from "./EditMedia.vue"
import LikeMedia from "./LikeMedia.vue"
import RequestInfoDialog from "./RequestInfoDialog.vue"
import MediaCommentsDialog from "components/dialogs/MediaCommentsDialog.vue"
import { useRouter } from "vue-router"
import { usePopularityStore } from "src/stores/popularityStore"

interface Props {
  allowDelete?: boolean
  downloadMode?: boolean
  initialCommentId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  allowDelete: true,
  downloadMode: false,
  initialCommentId: null,
})

const emit = defineEmits<{
  close: []
}>()

const mediaViewerStore = useMediaViewerStore()
const userAuth = useUserAuth()
const router = useRouter()
const shareMenuOpen = ref(true)
const moreMenuOpen = ref(true)
const popularity = usePopularityStore()
const pendingCommentId = ref<string | null>(props.initialCommentId)
const autoOpenedInitialComment = ref(false)

// Optional privacy knowledge propagated via mediaObjects entries
// const currentIsPublic = computed(() => mediaViewerStore.mediaObjects[mediaViewerStore.currentIndex]?.isPublic)
const currentIsPublic = computed(() => true)

const userCreatedImage = computed(() => {
  if (!mediaViewerStore.creatorMeta) return false
  return mediaViewerStore.creatorMeta.id === userAuth.userId
})

async function mobileShare() {
  const url =
    window.location.origin +
    router.resolve({
      name: "mediaRequest",
      params: {
        requestShortId: longIdToShort(mediaViewerStore.loadedRequestId || ""),
        type: mediaViewerStore.currentMediaType,
        index: mediaViewerStore.currentIndex || 0,
      },
      query: userAuth.userProfile?.username ? { referredBy: userAuth.userProfile.username } : {},
    }).href

  // Use shareMedia only if on mobile and Web Share API supports files, else use shareLink
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
  const fileName = `${mediaViewerStore.currentMediaId}-fiddl-art.${mediaViewerStore.currentMediaType === "video" ? "mp4" : "webp"}`
  const file = new File([], fileName)
  if (isMobile && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await shareMedia("Fiddl.art Creation", "Check out this creation on Fiddl.art", mediaViewerStore.getCurrentMediaUrl(), fileName)
  } else {
    await shareLink("Fiddl.art Creation", "Check out this creation on Fiddl.art", url)
  }
}

async function share() {
  try {
    let params: any = { requestShortId: "", type: mediaViewerStore.currentMediaType, index: 0 }
    let query: any = {}
    let localRequestId = mediaViewerStore.loadedRequestId

    if (!localRequestId) {
      const { data } = await creationsGetCreationData(mediaViewerStore.getMediaParams())
      localRequestId = data.requestId
    }

    params.requestShortId = longIdToShort(localRequestId)
    params.type = mediaViewerStore.currentMediaType
    const requestData = await getCreationRequest(localRequestId, mediaViewerStore.currentMediaType)
    const mediaIndex = requestData.mediaIds.findIndex((el: string) => el === mediaViewerStore.currentMediaId) || 0
    params.index = mediaIndex

    let hasUsername = !!(userAuth.loggedIn && userAuth.userProfile?.username)
    if (!hasUsername && userAuth.loggedIn) await userAuth.loadUserProfile()
    hasUsername = !!userAuth.userProfile?.username
    if (hasUsername) query.referredBy = userAuth.userProfile?.username

    const url = router.resolve({ name: "mediaRequest", params, query }).href
    const fullUrl = window.location.origin + url
    copyToClipboard(fullUrl)

    Dialog.create({
      title: "Image URL Copied",
      message: "The image URL has been copied to your clipboard. If you are logged in with a username set then your referral link is also included in the URL.",
      position: "top",
    })
  } catch (err: any) {
    catchErr(err)
  }
}

function showRequestInfoDialog() {
  if (!mediaViewerStore.loadedRequestId || mediaViewerStore.loadedRequestId.length === 0) return
  Dialog.create({
    component: RequestInfoDialog,
    componentProps: {
      requestId: mediaViewerStore.loadedRequestId,
      type: mediaViewerStore.currentMediaType,
    },
  })
}

function showCommentsDialog(targetCommentId?: string | null) {
  if (!mediaViewerStore.currentMediaId) return
  const previewUrl = mediaViewerStore.getCurrentMediaUrl()
  Dialog.create({
    component: MediaCommentsDialog,
    componentProps: {
      mediaId: mediaViewerStore.currentMediaId,
      mediaType: mediaViewerStore.currentMediaType,
      previewUrl,
      targetCommentId: targetCommentId ?? null,
    },
  })
}

function openPendingCommentDialog() {
  const target = pendingCommentId.value
  if (!target) return
  autoOpenedInitialComment.value = true
  const resolvedTarget = target === COMMENT_DIALOG_SENTINEL ? null : target
  showCommentsDialog(resolvedTarget)
  pendingCommentId.value = null
}

async function toggleFavorite() {
  if (!userAuth.loggedIn) {
    Dialog.create({
      title: "Login required",
      message: "You need to login to like images",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void router.push({ name: "login" })
    })
    return
  }

  const id = mediaViewerStore.currentMediaId
  const type = mediaViewerStore.currentMediaType
  const isFav = !!popularity.get(id)?.isFavoritedByMe

  // If attempting to favorite and media is not owned/unlocked, show unlock dialog instantly
  if (!mediaViewerStore.userOwnsMedia && !isFav) {
    Dialog.create({
      component: LikeMedia,
      componentProps: mediaViewerStore.getDialogParams(),
    }).onOk(() => {
      void popularity.toggleFavorite(id, type)
    })
    return
  }

  // Unfavorite or already owned -> proceed
  void popularity.toggleFavorite(id, type)
}

function onUpvote() {
  if (!userAuth.loggedIn) {
    Dialog.create({
      title: "Login required",
      message: "You get free upvotes each day, but you need to login first.",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void router.push({ name: "login" })
    })
    return
  }
  // If we explicitly know the media is private, block with a friendly message
  if (currentIsPublic.value === false) {
    Dialog.create({
      title: "Private Media",
      message: "This media is private and cannot be upvoted.",
      ok: { label: "OK", flat: true, color: "primary" },
    })
    return
  }

  void (async () => {
    try {
      await popularity.addUpvote(mediaViewerStore.currentMediaId, mediaViewerStore.currentMediaType)
    } catch (e) {
      Dialog.create({
        title: "Unable to Upvote",
        message: "This media may be private and cannot be upvoted.",
        ok: { label: "OK", flat: true, color: "primary" },
      })
    }
  })()
}

function editMedia() {
  Dialog.create({
    component: EditMedia,
    componentProps: mediaViewerStore.getDialogParams(),
  }).onOk(() => {
    mediaViewerStore.userOwnsMedia = true
    mediaViewerStore.triedHdLoad = false
    void mediaViewerStore.loadHdMedia()
  })
}

function showDownloadWindow() {
  Dialog.create({
    component: DownloadMedia,
    componentProps: {
      ...mediaViewerStore.getDialogParams(),
      requestId: mediaViewerStore.loadedRequestId,
    },
  })
    .onOk(() => {
      mediaViewerStore.userOwnsMedia = true
      mediaViewerStore.triedHdLoad = false
      void mediaViewerStore.loadHdMedia()
    })
    .onDismiss(() => {
      mediaViewerStore.triedHdLoad = false
      mediaViewerStore.hdMediaLoaded = false
      // mediaViewerStore.imgLoading = true
      void mediaViewerStore.loadHdMedia()
    })
}

watch(
  () => mediaViewerStore.currentMediaId,
  async (mediaId) => {
    if (!mediaId) return
    if (!pendingCommentId.value) return
    if (autoOpenedInitialComment.value) return
    await nextTick()
    if (!pendingCommentId.value || autoOpenedInitialComment.value) return
    openPendingCommentDialog()
  },
  { immediate: true },
)

watch(
  () => props.initialCommentId,
  async (value) => {
    if (!value) return
    pendingCommentId.value = value
    autoOpenedInitialComment.value = false
    if (!mediaViewerStore.currentMediaId) return
    await nextTick()
    if (!pendingCommentId.value || autoOpenedInitialComment.value) return
    openPendingCommentDialog()
  },
)

function setProfileImage() {
  Dialog.create({
    component: CreateAvatar,
    componentProps: mediaViewerStore.getDialogParams(),
  })
}

function deleteMedia() {
  Dialog.create({
    title: "Delete Creation",
    message: "Are you sure you want to delete this creation?",
    ok: { label: "Delete", color: "negative" },
    cancel: { label: "Cancel", color: "primary" },
  }).onOk(async () => {
    mediaViewerStore.loading = true

    await mediaViewerStore.loadRequestId()
    const requestId = mediaViewerStore.loadedRequestId
    const deletedId = mediaViewerStore.currentMediaId

    try {
      await creationsDeleteMedia(mediaViewerStore.getMediaParams())
    } catch (error) {
      catchErr(error)
    }

    const shouldClose = mediaViewerStore.removeMedia(deletedId)
    if (shouldClose) {
      emit("close")
      return
    }

    setTimeout(() => {
      mediaViewerStore.loading = false
    }, 500)

    if (requestId) {
      if (mediaViewerStore.currentMediaType === "image") {
        useImageCreations().deleteImage(deletedId, requestId)
        useBrowserStore().removeMedia(deletedId)
      } else {
        useVideoCreations().deleteVideo(deletedId, requestId)
      }
    }
  })
}
</script>
