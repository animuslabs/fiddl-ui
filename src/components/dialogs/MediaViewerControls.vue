<template lang="pug">
div.media-viewer-shell
  div.media-viewer-frame(:style="frameStyle")
    div.viewer-top-bar(
      v-if="!downloadMode"
      :class="{ 'with-creator': showCreatorInfo }"
      :style="barVisualStyle"
    )
      div.viewer-top-left
        CreatorInfo(
          v-if="showCreatorInfo"
          :creatorMeta="mediaViewerStore.creatorMeta"
          avatarSize="28px"
          usernameClass="text-white text-body2"
          wrapperClass="viewer-creator"
        )
      div.viewer-top-actions
        q-btn(
          v-if="mediaViewerStore.loadedRequestId"
          icon="sym_o_info"
          round
          flat
          color="white"
          :size="topButtonSize"
          :dense="topButtonDense"
          @click.stop="showRequestInfoDialog()"
        )
        q-btn(
          v-if="!isCompact"
          icon="download"
          round
          flat
          :class="mediaViewerStore.downloadClass"
          color="white"
          :size="topButtonSize"
          :dense="topButtonDense"
          @click.stop="showDownloadWindow()"
        )
          q-tooltip
            p(v-if="mediaViewerStore.userOwnsMedia") Download full resolution original and upscaled versions
            p(v-else).text-capitalize Download {{ mediaViewerStore.currentMediaType }}
        q-btn(
          icon="edit"
          round
          flat
          :size="topButtonSize"
          :dense="topButtonDense"
          :color="mediaViewerStore.editBtnColor"
          @click.stop="editMedia()"
        )
        q-spinner(
          v-if="shareLoading"
          size="20px"
          color="white"
          class="share-spinner q-mr-sm"
        )
        q-btn(
          icon="more_vert"
          round
          flat
          color="white"
          :size="topButtonSize"
          :dense="topButtonDense"
          @click.stop="moreMenuOpen = true"
        )
          q-menu(
            v-model:show="moreMenuOpen"
            anchor="bottom right"
            self="top right"
            class="viewer-menu"
            @click.stop
          )
            q-list
              q-item(
                v-if="isCompact"
                clickable
                :disable="shareLoading"
                @click.stop="mobileShare()"
                v-close-popup
              )
                q-item-section
                  .row.items-center
                    q-icon(:name="shareIcon" size="20px").q-mr-md
                    div Share Creation
              q-item(
                v-if="isCompact"
                clickable
                @click.stop="share()"
                v-close-popup
              )
                q-item-section
                  .row.items-center
                    q-icon(name="content_copy" size="20px").q-mr-md
                    div Copy Link
              q-item(
                v-if="isCompact"
                clickable
                @click.stop="showDownloadWindow()"
                v-close-popup
              )
                q-item-section
                  .row.items-center
                    q-icon(name="download" size="20px").q-mr-md
                    div Download
              q-item(
                v-if="mediaViewerStore.currentMediaType === 'image'"
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
                v-if="userCreatedImage && allowDelete"
                @click="deleteMedia()"
                v-close-popup
              )
                q-item-section
                  .row.items-center
                    q-icon(name="delete" size="20px").q-mr-md
                    div Delete
        q-btn(
          icon="close"
          round
          flat
          color="white"
          size="sm"
          :dense="$q.screen.lt.md"
          @click.stop="$emit('close')"
        )
    div.viewer-media-slot
      slot
    div.viewer-bottom-bar(
      v-if="!downloadMode"
      :style="barVisualStyle"
      :class="{ 'has-counts': hasAnyCounts }"
    )
      div.pop-row(:class="{ 'has-any-counts': hasAnyCounts }")
        div.pop-item
          q-btn(
            icon="share"
            round
            flat
            size="sm"
            :dense="$q.screen.lt.md"
            color="white"
            :loading="shareLoading"
            :disable="shareLoading"
            @click.stop="shareMenuOpen = true"
          )
            q-menu(
              v-model:show="shareMenuOpen"
              anchor="top middle"
              self="bottom middle"
              class="viewer-menu"
              @click.stop
            )
              q-list
                q-item(clickable @click.stop="mobileShare()" v-close-popup :disable="shareLoading")
                  q-item-section
                    .row.items-center
                      q-icon(:name="shareIcon" size="20px").q-mr-md
                      div Share Creation
                q-item(clickable @click="share()" v-close-popup)
                  q-item-section
                    .row.items-center
                      q-icon(name="content_copy" size="20px").q-mr-md
                      div Copy Link
        div.pop-item
          q-btn(
            icon="favorite"
            round
            flat
            size="sm"
            :dense="$q.screen.lt.md"
            :color="isFavorited ? 'red-5' : 'white'"
            @click.stop="toggleFavorite()"
          )
          span.count(:class="{ empty: !favoriteCount }") {{ favoriteCount }}
        div.pop-item
          q-btn(
            icon="chat_bubble"
            round
            flat
            size="sm"
            :dense="$q.screen.lt.md"
            color="white"
            @click.stop="showCommentsDialog()"
          )
          span.count(:class="{ empty: !commentCount }") {{ commentCount }}
        div.pop-item
          q-btn(
            :icon="isUpvoted ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'"
            round
            flat
            size="sm"
            :dense="$q.screen.lt.md"
            color="white"
            v-if="currentIsPublic !== false"
            @click.stop="onUpvote()"
          )
          span.count(:class="{ empty: !upvoteCount }") {{ upvoteCount }}
        div.pop-item
          q-btn(
            icon="thumb_down"
            round
            flat
            size="sm"
            :dense="$q.screen.lt.md"
            color="white"
            @click.stop="onDownvote()"
          )
          span.count.empty 0
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue"
import { Dialog, useQuasar, type DialogChainObject } from "quasar"
import CreatorInfo from "src/components/CreatorInfo.vue"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { useUserAuth } from "src/stores/userAuth"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { useBrowserStore } from "src/stores/browserStore"
import { creationsDeleteMedia, creationsGetCreationData, creationsHdVideo } from "src/lib/orval"
import { catchErr, copyToClipboard, ensureShortRequestId, getCreationRequest, isRateLimitError, longIdToShort, normalizeRequestId, shareMedia, shareLink } from "src/lib/util"
import { originalDownloadUrl } from "lib/imageCdn"
import { img, s3Video } from "lib/netlifyImg"
import { COMMENT_DIALOG_SENTINEL } from "lib/mediaViewer"
import DownloadMedia from "./DownloadMedia.vue"
import CreateAvatar from "./CreateAvatar.vue"
import EditMedia from "./EditMedia.vue"
import LikeMedia from "./LikeMedia.vue"
import RequestInfoDialog from "./RequestInfoDialog.vue"
import { useRouter } from "vue-router"
import { usePopularityStore } from "src/stores/popularityStore"
import { showCommentsDialog as showCommentsDialogController } from "src/lib/commentsDialogController"

let activeCommentsDialog: DialogChainObject | null = null

interface Props {
  allowDelete?: boolean
  downloadMode?: boolean
  initialCommentId?: string | null
  mediaWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  allowDelete: true,
  downloadMode: false,
  initialCommentId: null,
  mediaWidth: 0,
})

const emit = defineEmits<{
  close: []
}>()

const MAX_FRAME_WIDTH = 1100

const mediaViewerStore = useMediaViewerStore()
const $q = useQuasar()
const userAuth = useUserAuth()
const router = useRouter()
const popularity = usePopularityStore()

const shareMenuOpen = ref(false)
const moreMenuOpen = ref(false)
const pendingCommentId = ref<string | null>(props.initialCommentId)
const autoOpenedInitialComment = ref(false)
const shareLoading = ref(false)

const currentIsPublic = computed(() => true)

const userCreatedImage = computed(() => {
  if (!mediaViewerStore.creatorMeta) return false
  return mediaViewerStore.creatorMeta.id === userAuth.userId
})

const favoriteCount = computed(() => popularity.get(mediaViewerStore.currentMediaId)?.favorites ?? 0)
const commentCount = computed(() => popularity.get(mediaViewerStore.currentMediaId)?.commentsCount ?? 0)
const upvoteCount = computed(() => popularity.get(mediaViewerStore.currentMediaId)?.upvotes ?? 0)
const isFavorited = computed(() => popularity.get(mediaViewerStore.currentMediaId)?.isFavoritedByMe === true)
const isUpvoted = computed(() => popularity.get(mediaViewerStore.currentMediaId)?.isUpvotedByMe === true)

const showCreatorInfo = computed(() => mediaViewerStore.creatorMeta.userName.length > 0)
const shareIcon = computed(() => (mediaViewerStore.currentMediaType === "image" ? "image" : "smart_display"))
const isCompact = computed(() => frameWidthValue.value < 520 || $q.screen.lt.sm)
const hasAnyCounts = computed(() => favoriteCount.value > 0 || commentCount.value > 0 || upvoteCount.value > 0)
const topButtonSize = computed(() => (isCompact.value ? "sm" : "md"))
const topButtonDense = computed(() => (isCompact.value ? true : $q.screen.lt.md))

const fallbackFrameWidth = computed(() => {
  const available = Math.max(320, $q.screen.width - 32)
  return Math.min(available, MAX_FRAME_WIDTH)
})

const frameWidthValue = computed(() => {
  const width = props.mediaWidth ?? 0
  if (width > 0) return Math.min(width, fallbackFrameWidth.value)
  return fallbackFrameWidth.value
})

const frameStyle = computed(() => {
  const width = Math.max(0, Math.round(frameWidthValue.value))
  const style: Record<string, string> = {
    maxWidth: `min(95vw, ${MAX_FRAME_WIDTH}px)`,
  }
  if (width > 0) style.width = `${width}px`
  return style
})

const currentMedia = computed(() => mediaViewerStore.mediaObjects[mediaViewerStore.currentIndex])

const barBgUrl = computed(() => {
  const media = currentMedia.value
  if (!media) return ""
  if (media.placeholder) return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
  const type = media.type ?? media.mediaType ?? mediaViewerStore.currentMediaType
  if (type === "video") return s3Video(media.id, "thumbnail")
  return img(media.id, "sm")
})

const barVisualStyle = computed(() => {
  const url = barBgUrl.value
  if (!url) return { "--mv-bar-bg": "none" }
  return { "--mv-bar-bg": `url('${url}')` }
})

watch(
  () => props.downloadMode,
  (hidden) => {
    if (!hidden) return
    shareMenuOpen.value = false
    moreMenuOpen.value = false
  },
)

watch(
  isCompact,
  (compact) => {
    if (compact) shareMenuOpen.value = false
  },
  { immediate: true },
)

async function resolveRequestIdentifiers(): Promise<{ longId: string; shortId: string }> {
  let requestId = mediaViewerStore.loadedRequestId
  if (!requestId) {
    requestId = (await mediaViewerStore.loadRequestId()) ?? null
  }

  if (!requestId) {
    const { data } = await creationsGetCreationData(mediaViewerStore.getMediaParams())
    const normalizedFromApi = normalizeRequestId(data?.requestId)
    if (!normalizedFromApi) {
      throw new Error("Creation request not found.")
    }
    mediaViewerStore.loadedRequestId = normalizedFromApi.longId
    const mediaEntry = mediaViewerStore.mediaObjects[mediaViewerStore.currentIndex]
    if (mediaEntry) {
      mediaEntry.requestId = normalizedFromApi.longId
    }
    return normalizedFromApi
  }

  const normalizedExisting = normalizeRequestId(requestId)
  if (normalizedExisting) {
    if (mediaViewerStore.loadedRequestId !== normalizedExisting.longId) {
      mediaViewerStore.loadedRequestId = normalizedExisting.longId
      const mediaEntry = mediaViewerStore.mediaObjects[mediaViewerStore.currentIndex]
      if (mediaEntry) {
        mediaEntry.requestId = normalizedExisting.longId
      }
    }
    return normalizedExisting
  }

  const trimmed = requestId.trim()
  if (!trimmed) {
    throw new Error("Creation request not found.")
  }
  const shortId = ensureShortRequestId(trimmed)
  mediaViewerStore.loadedRequestId = trimmed
  const mediaEntry = mediaViewerStore.mediaObjects[mediaViewerStore.currentIndex]
  if (mediaEntry) {
    mediaEntry.requestId = trimmed
  }
  return { longId: trimmed, shortId }
}

async function resolveRequestShareContext(): Promise<{ longId: string; shortId: string; mediaIndex: number }> {
  const identifiers = await resolveRequestIdentifiers()
  const requestData = await getCreationRequest(identifiers.longId, mediaViewerStore.currentMediaType)
  let mediaIndex = requestData.mediaIds.findIndex((el) => el === mediaViewerStore.currentMediaId)
  mediaIndex = mediaIndex >= 0 ? mediaIndex : 0
  return { ...identifiers, mediaIndex }
}

function inferExtensionFromUrl(url: string, fallback: string): string {
  try {
    const sanitized = url.split("?")[0]?.split("#")[0] ?? ""
    const match = sanitized.match(/\.([a-z0-9]+)$/i)
    if (match?.[1]) {
      return match[1].toLowerCase()
    }
  } catch {
    /* ignore parsing errors */
  }
  return fallback
}

type ResolvedShareAsset = { url: string; filename: string; preferImageType?: "image/jpeg" | "image/png" }

async function resolveShareMediaAsset(): Promise<ResolvedShareAsset | null> {
  const mediaId = mediaViewerStore.currentMediaId
  if (!mediaId) return null
  const type = mediaViewerStore.currentMediaType
  if (type === "image") {
    const ownsMedia = mediaViewerStore.userOwnsMedia || Boolean(mediaViewerStore.hdImageSrc[mediaId])
    if (ownsMedia) {
      await mediaViewerStore.loadHdMedia(mediaId)
    } else {
      await mediaViewerStore.loadLgImage(mediaId)
    }
    const hdUrl = mediaViewerStore.hdImageSrc[mediaId]
    const lgUrl = mediaViewerStore.lgImageSrc[mediaId]
    const displayUrl = mediaViewerStore.displayImageSrc[mediaId]
    const url = (ownsMedia && hdUrl) || lgUrl || displayUrl || hdUrl || img(mediaId, "lg")
    const baseFilename = ownsMedia ? `${mediaId}-fiddl-art-hd` : `${mediaId}-fiddl-art`
    const ext = inferExtensionFromUrl(url, "jpg")
    return { url, filename: `${baseFilename}.${ext}`, preferImageType: "image/jpeg" }
  }
  const url = mediaViewerStore.getCurrentMediaUrl()
  const ext = type === "video" ? "mp4" : inferExtensionFromUrl(url, "webp")
  return { url, filename: `${mediaId}-fiddl-art.${ext}` }
}

async function mobileShare() {
  if (shareLoading.value) return
  try {
    shareLoading.value = true
    const { shortId, mediaIndex } = await resolveRequestShareContext()
    const params = {
      requestShortId: shortId,
      type: mediaViewerStore.currentMediaType,
      index: String(mediaIndex),
    }
    const query =
      userAuth.userProfile?.username != null && userAuth.userProfile.username.length > 0
        ? { referredBy: userAuth.userProfile.username }
        : {}
    const url = window.location.origin + router.resolve({ name: "mediaRequest", params, query }).href
    const mediaAsset = await resolveShareMediaAsset()

    try {
      const tg: any = (window as any)?.Telegram?.WebApp
      const inTma = Boolean((window as any)?.__TMA__?.enabled && tg)
      if (inTma) {
        if (mediaViewerStore.currentMediaType === "image") {
          try {
            const orig = await originalDownloadUrl(mediaViewerStore.currentMediaId).catch(() => "")
            const canStory = typeof tg?.shareToStory === "function" && /\.(png|jpe?g)$/i.test(orig)
            if (canStory) {
              tg.shareToStory(orig, {
                text: "Made with Fiddl.art",
                widget_link: { url: window.location.origin, text: "Open Fiddl.art" },
              })
              return
            }
          } catch {}
        }
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Check out this creation on Fiddl.art")}`
        if (typeof tg?.openTelegramLink === "function") {
          tg.openTelegramLink(shareUrl)
          return
        }
      }
    } catch {}

    if (mediaAsset) {
      const shareOptions = {
        ...(mediaAsset.preferImageType ? { preferImageType: mediaAsset.preferImageType } : {}),
        onPreparing: (preparing: boolean) => {
          shareLoading.value = preparing
        },
      }
      const shared = await shareMedia("Fiddl.art Creation", "Check out this creation on Fiddl.art", mediaAsset.url, mediaAsset.filename, shareOptions)
      if (shared) return
    }
    await shareLink("Fiddl.art Creation", "Check out this creation on Fiddl.art", url)
  } catch (err: any) {
    if (isRateLimitError(err)) {
      mediaViewerStore.startRateLimitCooldown()
    } else {
      catchErr(err)
    }
  } finally {
    shareLoading.value = false
  }
}

async function share() {
  try {
    const { shortId, mediaIndex } = await resolveRequestShareContext()
    const params = {
      requestShortId: shortId,
      type: mediaViewerStore.currentMediaType,
      index: String(mediaIndex),
    }
    const query: Record<string, string> = {}
    let hasUsername = !!(userAuth.loggedIn && userAuth.userProfile?.username)
    if (!hasUsername && userAuth.loggedIn) await userAuth.loadUserProfile()
    hasUsername = !!userAuth.userProfile?.username
    if (hasUsername && userAuth.userProfile?.username) {
      query.referredBy = userAuth.userProfile.username
    }

    const url = router.resolve({ name: "mediaRequest", params, query }).href
    const fullUrl = window.location.origin + url
    copyToClipboard(fullUrl)

    Dialog.create({
      title: "Image URL Copied",
      message: "The image URL has been copied to your clipboard. If you are logged in with a username set then your referral link is also included in the URL.",
      position: "top",
    })
  } catch (err: any) {
    if (isRateLimitError(err)) {
      mediaViewerStore.startRateLimitCooldown()
    } else {
      catchErr(err)
    }
  }
}

async function showRequestInfoDialog() {
  try {
    const { longId } = await resolveRequestIdentifiers()
    if (!longId) return
    Dialog.create({
      component: RequestInfoDialog,
      componentProps: {
        requestId: longId,
        type: mediaViewerStore.currentMediaType,
      },
    })
  } catch (err: any) {
    if (isRateLimitError(err)) {
      mediaViewerStore.startRateLimitCooldown()
    } else {
      catchErr(err)
    }
  }
}

function showCommentsDialog(targetCommentId?: string | null) {
  if (!mediaViewerStore.currentMediaId) return
  const previewUrl = mediaViewerStore.getCurrentMediaUrl()
  mediaViewerStore.pauseActiveVideo()
  showCommentsDialogController({
    mediaId: mediaViewerStore.currentMediaId,
    mediaType: mediaViewerStore.currentMediaType,
    previewUrl,
    targetCommentId: targetCommentId ?? null,
    forceMobileLayout: $q.screen.lt.md,
    maximized: $q.screen.lt.md,
    onDismiss: () => {
      mediaViewerStore.playActiveVideo()
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

  if (!mediaViewerStore.userOwnsMedia && !isFav) {
    Dialog.create({
      component: LikeMedia,
      componentProps: mediaViewerStore.getDialogParams(),
    }).onOk(() => {
      void popularity.toggleFavorite(id, type)
    })
    return
  }

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
  const id = mediaViewerStore.currentMediaId
  const type = mediaViewerStore.currentMediaType
  void popularity.addUpvote(id, type)
}

function onDownvote() {
  if (!mediaViewerStore.currentMediaId) return
  void popularity.downvoteAndHide(mediaViewerStore.currentMediaId, mediaViewerStore.currentMediaType)
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

async function tmaDownloadCurrent(): Promise<boolean> {
  try {
    const tg: any = (window as any)?.Telegram?.WebApp
    const inTma = Boolean((window as any)?.__TMA__?.enabled && tg && typeof tg.downloadFile === "function")
    if (!inTma) return false

    if (!mediaViewerStore.userOwnsMedia) return false

    const id = mediaViewerStore.currentMediaId
    if (!id) return false

    if (mediaViewerStore.currentMediaType === "image") {
      let url = await originalDownloadUrl(id).catch(() => "")
      if (!url) url = mediaViewerStore.hdImageSrc[id] || ""
      if (!url) url = img(id, "lg")
      const ext = (/\.([a-z0-9]+)(?:\?|$)/i.exec(url)?.[1] || "png").toLowerCase()
      const filename = `fiddl.art-${longIdToShort(id)}.${ext}`
      tg.downloadFile({ url, file_name: filename, filename }, () => {})
      return true
    } else {
      const { data } = await creationsHdVideo({ download: true, videoId: id })
      const filename = `fiddl.art-${longIdToShort(id)}-original.mp4`
      tg.downloadFile({ url: data, file_name: filename, filename }, () => {})
      return true
    }
  } catch {
    return false
  }
}

function showDownloadWindow() {
  void (async () => {
    const handled = await tmaDownloadCurrent()
    if (handled) return

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
        void mediaViewerStore.loadHdMedia()
      })
  })()
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

<style scoped>
.media-viewer-shell {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 16px 18px 32px;
  box-sizing: border-box;
}

.media-viewer-frame {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  width: auto;
  gap: 0;
  background: none;
}

.viewer-top-bar,
.viewer-bottom-bar {
  width: 100%;
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  min-height: 48px;
  border-radius: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
}

.viewer-top-bar::before,
.viewer-bottom-bar::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--mv-bar-bg, none);
  background-size: cover;
  background-position: center;
  filter: blur(12px);
  transform: scale(1.25);
  opacity: 0.5;
  z-index: 0;
}

.viewer-top-bar::before {
  background-position: center top;
}

.viewer-bottom-bar::before {
  background-position: center bottom;
}

.viewer-top-bar::after,
.viewer-bottom-bar::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.18));
  z-index: 0;
}

.viewer-top-bar > *,
.viewer-bottom-bar > * {
  position: relative;
  z-index: 1;
}

.viewer-top-bar {
  justify-content: flex-end;
}

.viewer-top-bar.with-creator {
  justify-content: space-between;
}

.viewer-top-left {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 10px;
}

.viewer-top-bar:not(.with-creator) .viewer-top-left {
  display: none;
}

.viewer-creator {
  color: #fff;
  min-width: 0;
}

.viewer-top-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex: 0 0 auto;
  flex-wrap: wrap;
  min-width: 0;
}

.viewer-top-actions .q-btn {
  min-width: 0;
}

.share-spinner {
  flex: 0 0 auto;
}

.viewer-media-slot {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 0;
}

.viewer-bottom-bar {
  justify-content: center;
}

.pop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  column-gap: 12px;
  width: 100%;
}

.pop-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 0;
  justify-content: center;
  min-width: 0;
}

.pop-item .q-btn {
  min-width: 0;
}

.pop-item .count {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}

.pop-item .count.empty {
  display: none;
}

@media (max-width: 600px) {
  .viewer-top-actions {
    gap: 8px;
  }
  .pop-row {
    column-gap: 10px;
  }
  .pop-item {
    gap: 6px;
  }
  .pop-item .count {
    font-size: 11px;
  }
}
</style>
