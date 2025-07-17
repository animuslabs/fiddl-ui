<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" maximized :persistent="isPersistent")
  q-card.q-dialog-plugin(style="width:90vw;" @click="hide()").bg-transparent
    .centered
      .col-auto
        .full-width
          .relative-position
            .centered.q-mb-md.q-mt-lg.relative-position.items-center(:style="{visibility: downloadMode ? 'hidden' : 'visible'}")
              div.relative-position
                q-btn(
                  icon="share"
                  round
                  flat
                  color="grey-5"
                  @click.stop="shareMenu = true"
                )
                  q-menu(
                    v-if="shareMenu"
                    anchor="bottom left"
                    self="top left"
                    @click.stop="shareMenu = false"
                  )
                    q-list
                      q-item(clickable @click.stop="mobileShare()" v-close-popup)
                        q-item-section
                          .row.items-center
                            q-icon(:name="type=='image'?'image':'smart_display'" size="20px").q-mr-md
                            div Share Creation
                      q-item(clickable @click="share()" v-close-popup)
                        q-item-section
                          .row.items-center
                            q-icon(name="content_copy" size="20px").q-mr-md
                            div Copy Link
              q-btn(icon="sym_o_info" flat round @click.stop="goToRequestPage()" color="grey-5" v-if="loadedRequestId")
              div
                q-btn(icon="download" flat @click.stop="showDownloadWindow()" round :class="downloadClass")
                  q-tooltip
                    p(v-if="userOwnsMedia") Download full resolution original and upscaled versions
                    p(v-else).text-capitalize Download {{ type }}
              q-btn(icon="edit" flat round @click.stop="editMedia()" :color="editBtnColor")
              q-btn(icon="sym_o_favorite" flat round @click.stop="toggleLike()" :color="favoriteBtnColor" :loading="loadingLike")
              div.relative-position
                q-btn(
                  icon="more_vert"
                  round
                  flat
                  color="grey-5"
                  @click.stop="moreOptionsMenu = true"
                )
                  q-menu(
                    v-if="moreOptionsMenu"
                    anchor="bottom right"
                    self="top right"
                    @click.stop="moreOptionsMenu = false"
                  )
                    q-list
                      q-item( v-if="type=='image'" clickable @click="setProfileImage()" v-close-popup)
                        q-item-section
                          .row.items-center
                            q-icon(name="account_circle" size="20px").q-mr-md
                            div Use as Profile Image
                      q-item(clickable @click="deleteImage()" v-close-popup v-if="userCreatedImage")
                        q-item-section
                          .row.items-center
                            q-icon(name="delete" size="20px").q-mr-md
                            div Delete
              div
                q-btn(icon="close" flat @click.stop="hide" round color="grey-5")
    .centered
      div.relative-position(
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      )
        transition(name="fade")
          q-linear-progress.absolute-top.full-width.image-darken(
            style="top:-2px;"
            indeterminate
            v-if="imgLoading || loading"
            color="primary"
            track-color="transparent"
          )
        component( :is="type === 'video' ? 'video' : 'img'" v-bind="mediaAttrs" ref="mediaElement" style="min-width:50vw;" )
        img.image-darken.absolute-center(
          :src="nextMediaUrl"
          @click.stop="onImageClick"
          alt="user created image"
          style="width:85%; max-height: 75vh; object-fit: contain; z-index: -1;"
        ).lt-md
        .row(v-if="!creatorMeta.userName.length && !userOwnsMedia" style="bottom:-0px" @click="goToCreator()").items-center.absolute-bottom
          .col-auto.q-pa-sm.cursor-pointer(style="background-color:rgba(0,0,0,0.5);")
            .row.items-center.q-mb-xs
              q-img(placeholder-src="/blankAvatar.webp" :src="avatarImg(creatorMeta.id||'')" style="width:30px; height:30px; border-radius:50%;").q-mr-sm
              h6.q-mr-sm @{{creatorMeta.userName}}
    .centered
      div.q-mt-md(v-if="localMediaIds.length > 1 && !downloadMode && localMediaIds.length < 11")
        span.indicator(v-for="(image, index) in localMediaIds" :key="index" :class="{ active: index === currentIndex }" @click.stop="goTo(index)")
</template>

<style scoped>
.fade-enter-active {
  transition: opacity 0.5s ease 0.5s;
}
.fade-enter {
  opacity: 0;
}
.fade-enter-to {
  opacity: 1;
}
.image-darken {
  background-color: transparent;
  color: transparent;
  transition: filter 0.3s ease;
}
.image-darken.active {
  filter: blur(3px) brightness(50%) saturate(50%);
}
.indicator {
  display: inline-block;
  height: 10px;
  width: 10px;
  margin: 0 5px 0px;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  cursor: pointer;
}
.active {
  background-color: rgba(255, 255, 255, 1);
}
</style>
<script lang="ts">
import { Dialog, QDialog, SessionStorage } from "quasar"
import { defineComponent, PropType, Ref, ref } from "vue"
import { collectionsMediaInUsersCollection, creationsHdVideo, collectionsLikeMedia, collectionsUnlikeMedia, creationsDeleteMedia, creationsGetCreationData, userGetUsername, creationsHdImage, creationsGetImageRequest, creationsGetVideoRequest } from "src/lib/orval"
import { avatarImg, img } from "lib/netlifyImg"
import { catchErr, copyToClipboard, longIdToShort, preloadHdVideo, shareLink, shareMedia, updateQueryParams } from "lib/util"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import DownloadImage from "./DownloadImage.vue"
import EditImage from "./EditImage.vue"
import LikeImage from "./LikeImage.vue"
import CreateAvatar from "src/components/dialogs/CreateAvatar.vue"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useBrowserStore } from "src/stores/browserStore"
import { s3Video } from "lib/netlifyImg"
import { useUserAuth } from "src/stores/userAuth"
import { match } from "ts-pattern"
import EditVideo from "components/dialogs/EditVideo.vue"

export default defineComponent({
  props: {
    mediaIds: {
      type: Array as () => string[],
      required: true,
    },
    type: {
      type: String as () => "image" | "video",
      required: true,
    },
    requestId: {
      type: String,
      default: "",
      required: false,
    },
    startIndex: {
      type: Number,
      default: 0,
      required: false,
    },
  },
  emits: ["ok", "hide"],
  data() {
    return {
      dynamic: false,
      userAuth: useUserAuth(),
      creationStore: useImageCreations(),
      shareMenu: true,
      moreOptionsMenu: true,
      localMediaIds: [] as string[],
      avatarImg,
      imageDeleted: false,
      isPersistent: false,
      preloaded: false,
      downloadMode: false,
      imgLoading: true,
      userOwnsMedia: false,
      loading: false,
      currentIndex: 0,
      isFullScreen: false,
      touchStartX: 0,
      touchMoveX: 0, // Added to track horizontal movement
      isSwiping: false, // Indicates if a swipe is in progress
      threshold: 50, // Minimum swipe distance to trigger navigation
      firstImageLoaded: false,
      upscaling: false,
      userLikedMedia: false,
      loadingLike: false,
      loadedRequestId: null as string | null,
      hdMediaLoaded: false, // Added flag
      creatorMeta: {
        userName: "",
        id: "",
      },
    }
  },
  computed: {
    mediaParams() {
      return this.buildMediaParam()
    },
    currentMediaUrl() {
      return this.getMediaUrl(this.currentMediaId)
    },
    nextMediaUrl() {
      if (this.localMediaIds.length === 1) return this.currentMediaUrl
      const nextIndex = this.touchMoveX > 0 ? (this.currentIndex - 1 + this.localMediaIds.length) % this.localMediaIds.length : (this.currentIndex + 1) % this.localMediaIds.length
      const id = this.localMediaIds[nextIndex] as string
      return this.getMediaUrl(id)
    },
    mediaAttrs() {
      const base = {
        class: "image-darken",
        style: {
          width: "100%",
          maxHeight: "75vh",
          objectFit: "contain",
          transform: `translateX(${this.touchMoveX}px)`,
        },
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          this.onImageClick(e)
        },
      }

      if (this.type === "video") {
        return {
          ...base,
          src: this.currentMediaUrl,
          playsinline: true,
          autoplay: true,
          muted: false,
          loop: true,
          controls: true,
          onCanplay: (e: Event) => this.mediaLoaded(e),
        }
      }

      return {
        ...base,
        src: this.currentMediaUrl,
        ref: "overlayImage",
        onLoad: (e: Event) => this.mediaLoaded(e),
        alt: "user created image",
        class: this.mediaClass,
      }
    },
    userCreatedImage() {
      if (!this.creatorMeta) return false
      return this.creatorMeta.id == this.userAuth.userId
    },
    mediaClass() {
      if (!this.firstImageLoaded) return ""
      else return this.loading || this.imgLoading ? "image-darken active" : "image-darken"
    },
    favoriteBtnColor() {
      return this.userLikedMedia ? "accent" : this.userOwnsMedia ? "grey-5" : "grey-6"
    },
    editBtnColor() {
      return this.userOwnsMedia ? "primary" : "grey-6"
    },
    downloadClass() {
      return this.userOwnsMedia ? "text-primary" : "text-grey-6"
    },
    currentMediaId() {
      if (this.localMediaIds.length === 0) return ""
      return this.localMediaIds[this.currentIndex] as string
    },
  },
  watch: {
    currentIndex: {
      handler() {
        this.preloadMedia()
      },
      immediate: false,
    },
    mediaRequestId: {
      handler(val: string) {
        if (!val) return
        this.loadedRequestId = val
      },
      immediate: true,
    },
    currentMediaId: {
      async handler(val: string) {
        console.log("currentMediaId watcher")
        if (!this.userAuth.loggedIn) return
        this.hdMediaLoaded = false // Reset HD image loaded flag
        this.userLikedMedia = false
        this.loadingLike = true
        const response = await collectionsMediaInUsersCollection({ ...this.mediaParams, name: "likes" })
        console.log(response.data)
        this.userLikedMedia = response?.data
        this.loadingLike = false
        if (this.$route.name == "imageRequest") {
          const query = { index: this.currentIndex }
          const newQuery = { ...this.$route.query, ...query }
          void this.$nextTick(() => {
            updateQueryParams(newQuery)
          })
        }
      },
      immediate: false,
    },
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown)
  },
  mounted() {
    this.localMediaIds = [...this.mediaIds]
    this.currentIndex = this.startIndex
    this.preloadMedia()
    window.addEventListener("keydown", this.handleKeyDown)
    if (!this.creatorMeta.userName.length || !this.requestId) {
      this.dynamic = true
    }
    void this.loadRequestId()
  },
  methods: {
    async loadHdMedia(val?: string) {
      this.imgLoading = false
      if (!val) val = this.currentMediaId
      if (!this.userAuth.loggedIn) return
      this.userOwnsMedia = false

      let timer: any | null = null
      const timeoutPromise = new Promise<null>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Media loading timed out"))
          this.loading = false
          this.imgLoading = false
        }, 6000)
      })

      try {
        if (this.type === "image") {
          let imageData = await getImageFromCache(val)
          if (!imageData && !SessionStorage.getItem("noHdImage-" + val)) {
            const hdResponse = await Promise.race([
              creationsHdImage({ imageId: val }).catch(() => {
                SessionStorage.setItem("noHdImage-" + val, true)
                return undefined
              }),
              timeoutPromise,
            ])
            imageData = hdResponse?.data
            if (imageData) await storeImageInCache(val, imageData)
          }
          if (imageData) {
            this.userOwnsMedia = true
            const dataUrl = `data:image/webp;base64,${imageData}`
            await this.$nextTick()
            const img = this.$refs.overlayImage as HTMLImageElement
            if (img) img.src = dataUrl
          }
        } else if (this.type === "video") {
          const hdUrlResp = await creationsHdVideo({ videoId: val })
          const hdUrl = hdUrlResp?.data
          if (!hdUrl) return

          // const preloadEl = await preloadHdVideo(hdUrl)

          // const player = this.$refs.mediaElement as HTMLVideoElement
          // const currentTime = player.currentTime
          // const wasPlaying = !player.paused

          // player.src = hdUrl
          // player.load()

          // player.onloadedmetadata = () => {
          //   player.currentTime = currentTime
          //   if (wasPlaying) player.play().catch(() => {})
          // }

          // this.hdMediaLoaded = true
          this.userOwnsMedia = true
        }
      } catch (err) {
        console.error("Failed to load HD media:", err)
      } finally {
        if (timer) clearTimeout(timer)
        this.loading = false
      }
    },
    buildMediaParam(id?: string) {
      let val = id
      if (!val) val = this.currentMediaId
      return this.type === "video" ? { videoId: val } : { imageId: val }
    },
    getMediaUrl(id: string): string {
      return this.type === "video" ? s3Video(id, "preview-lg") : img(id, "lg")
    },
    deleteImage() {
      Dialog.create({
        title: "Delete Image",
        message: "Are you sure you want to delete this image?",
        ok: {
          label: "Delete",
          color: "negative",
        },
        cancel: {
          label: "Cancel",
          color: "primary",
        },
      }).onOk(async () => {
        this.loading = true
        this.imageDeleted = true
        try {
          await creationsDeleteMedia(this.buildMediaParam(this.currentMediaId))
        } catch (error) {
          catchErr(error)
        }
        if (this.localMediaIds.length == 1) this.hide()
        this.localMediaIds = this.localMediaIds.filter((el) => el !== this.currentMediaId)
        if (this.currentIndex >= this.localMediaIds.length - 2) this.currentIndex--
        setTimeout(() => {
          this.loading = false
        }, 500)
        await this.loadRequestId()
        if (!this.loadedRequestId) return
        useImageCreations().deleteImage(this.currentMediaId, this.loadedRequestId)
        useBrowserStore().deleteImage(this.currentMediaId, this.loadedRequestId)
      })
    },
    async loadRequestId() {
      // return
      if (!this.dynamic && this.requestId && this.creatorMeta.userName.length) return
      const imageResponse = await creationsGetCreationData(this.buildMediaParam(this.currentMediaId)).catch(catchErr)
      const imageMeta = imageResponse?.data
      if (!imageMeta) return
      this.loadedRequestId = imageMeta.requestId
      const usernameResponse = await userGetUsername({ userId: imageMeta.creatorId }).catch(catchErr)
      const creatorName = usernameResponse?.data || ""
      this.creatorMeta = { id: imageMeta.creatorId, userName: creatorName }
    },
    goToCreator() {
      if (!this.creatorMeta.userName.length) return
      void this.$router.push({ name: "profile", params: { username: this.creatorMeta.userName } })
    },
    setProfileImage() {
      Dialog.create({ component: CreateAvatar, componentProps: { userOwnsImage: this.userOwnsMedia, currentImageId: this.currentMediaId } })
    },
    goToRequestPage() {
      if (!this.loadedRequestId || this.loadedRequestId.length == 0) return
      this.hide()
      void this.$router.push({ name: "mediaRequest", params: { requestShortId: longIdToShort(this.loadedRequestId), type: this.type } })
    },
    async toggleLike() {
      if (!this.userAuth.loggedIn) {
        Dialog.create({
          title: "Login required",
          message: "You need to login to like images",
          cancel: true,
          persistent: true,
        }).onOk(() => {
          void this.$router.push({ name: "login" })
        })
        return
      }

      if (!this.userOwnsMedia) {
        // Show LikeImage dialog for users who don't own the image
        Dialog.create({
          component: LikeImage,
          componentProps: { userOwnsImage: this.userOwnsMedia, currentImageId: this.currentMediaId },
        }).onOk(() => {
          // When the user completes the purchase in LikeImage dialog
          // Refresh image ownership status and like the image
          void this.loadHdMedia()
          this.userLikedMedia = true
          collectionsLikeMedia(this.buildMediaParam()).catch(catchErr)
        })
        return
      }

      // Toggle like status for owned images
      this.userLikedMedia = !this.userLikedMedia

      try {
        if (this.userLikedMedia) {
          await collectionsLikeMedia(this.mediaParams)
        } else {
          await collectionsUnlikeMedia(this.mediaParams)
        }
      } catch (error) {
        // Revert UI state if API call fails
        this.userLikedMedia = !this.userLikedMedia
        catchErr(error)
      }
    },
    editMedia() {
      if (this.userOwnsMedia) {
        void this.$router.push({ name: "create", query: { mediaId: this.currentMediaId, type: this.type } })
        this.hide()
      } else {
        const component = this.type == "image" ? EditImage : EditVideo
        const componentProps = this.type == "image" ? { userOwnsImage: this.userOwnsMedia, imageId: this.currentMediaId } : { userOwnsVideo: this.userOwnsMedia, videoId: this.currentMediaId }
        Dialog.create({ component, componentProps }).onOk(() => {
          void this.$router.push({ name: "create", query: { mediaId: this.currentMediaId, type: this.type } })
          this.hide()
        })
      }
    },
    showDownloadWindow() {
      Dialog.create({ component: DownloadImage, componentProps: { userOwnsImage: this.userOwnsMedia, currentImageId: this.currentMediaId } }).onDismiss(() => {
        // After purchase or download
        this.hdMediaLoaded = false // Reset HD image loaded flag

        this.imgLoading = true
        void this.loadHdMedia()
      })
    },
    preloadMedia() {
      const preloadIndices = [this.currentIndex - 1, this.currentIndex + 1]
      preloadIndices.forEach((index) => {
        if (index >= 0 && index < this.localMediaIds.length) {
          const id = this.localMediaIds[index]
          if (!id) return
          const url = this.getMediaUrl(id)
          if (this.type === "image") {
            const imgElement = new Image()
            imgElement.src = url
          } else {
            const video = document.createElement("video")
            video.preload = "auto"
            video.src = url
            video.load()
          }
        }
      })
    },
    async mediaLoaded(event: Event) {
      if (this.hdMediaLoaded || this.loading) return // 🔒 prevent loop

      const isImage = this.type === "image"
      const el = event.target as HTMLImageElement | HTMLVideoElement

      if (isImage) {
        const imgEl = el as HTMLImageElement
        if (imgEl.src.startsWith("data:image/")) {
          this.hdMediaLoaded = true
        } else {
          await this.loadHdMedia()
        }
        this.imgLoading = false
      } else {
        const video = el as HTMLVideoElement
        const isPreview = video.src.includes("watermarked")

        if (isPreview) {
          this.imgLoading = false
          // Start async HD load without awaiting (silent upgrade)
          void this.loadHdMedia()
        } else {
          // HD video is now playing
          this.hdMediaLoaded = true
          this.imgLoading = false
        }
      }

      this.firstImageLoaded = true

      if (!this.preloaded) {
        this.preloaded = true
        this.preloadMedia()
        await this.loadRequestId()
      }
    },
    async mobileShare() {
      await shareMedia("Fiddl.art Creation", "Check out this creation on Fiddl.art", this.currentMediaUrl, `${this.currentMediaId}-fiddl-art.${this.type === "video" ? "mp4" : "webp"}`)
    },
    async share() {
      let params: any = { requestShortId: "" }
      let query: any = { index: this.currentIndex }
      let localRequestId = this.requestId
      console.log("sharing", localRequestId)
      if (!localRequestId) {
        const creationData = await creationsGetCreationData(this.mediaParams).catch(catchErr)
        const creationMeta = creationData?.data
        console.log("creationMeta", creationMeta)
        if (!creationMeta) return
        localRequestId = creationMeta.requestId
      }
      params.requestShortId = longIdToShort(localRequestId)
      params.type = this.type
      const requestData = await match(this.type)
        .with("image", async () => (await creationsGetImageRequest({ imageRequestId: localRequestId })).data)
        .with("video", async () => (await creationsGetVideoRequest({ videoRequestId: localRequestId })).data)
        .exhaustive()
      const mediaIds = "imageIds" in requestData ? requestData.imageIds : requestData.videoIds
      const mediaIndex = mediaIds.findIndex((el: string) => el == this.currentMediaId) || 0
      query.index = mediaIndex
      await this.userAuth.loadUserProfile()
      const hasUsername = !!(this.userAuth.loggedIn && this.userAuth.userProfile?.username)
      if (hasUsername) query.referredBy = this.userAuth.userProfile?.username
      const url = this.$router.resolve({ name: "mediaRequest", params, query }).href
      const fullUrl = window.location.origin + url
      copyToClipboard(fullUrl)
      // await shareLink("Fiddl.art Creation", "Check this out", fullUrl)
      Dialog.create({
        title: "Image URL Copied",
        message: "The image URL has been copied to your clipboard. If you are logged in with a username set then your referral link is also included in the URL.",
        position: "top",
      })
    },
    openDialog(startingIndex = 0) {
      this.currentIndex = startingIndex
      this.isFullScreen = true
    },
    next() {
      if (this.localMediaIds.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex + 1) % this.localMediaIds.length
      this.touchMoveX = 0 // Reset movement
    },
    prev() {
      if (this.localMediaIds.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex - 1 + this.localMediaIds.length) % this.localMediaIds.length
      this.touchMoveX = 0 // Reset movement
    },
    goTo(index: number) {
      this.currentIndex = index
    },
    openFullScreen() {
      this.isFullScreen = true
    },
    closeFullScreen() {
      this.isFullScreen = false
      this.downloadMode = false
    },
    onImageClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      const rect = target.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const width = rect.width
      if (clickX < width / 2) {
        this.prev()
      } else {
        this.next()
      }
    },
    handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          this.prev()
          break
        case "ArrowRight":
          this.next()
          break
        case "Escape":
          this.closeFullScreen()
          break
        default:
          break
      }
    },
    onTouchStart(e: TouchEvent) {
      if (!e.changedTouches[0]) return
      this.touchStartX = e.changedTouches[0].clientX
      this.isSwiping = true
      this.touchMoveX = 0 // Reset any previous movement
    },
    onTouchMove(e: TouchEvent) {
      if (!e.changedTouches[0]) return
      if (!this.isSwiping) return
      if (this.mediaIds.length === 1) return (this.touchMoveX = 0)
      const currentX = e.changedTouches[0].clientX
      const deltaX = currentX - this.touchStartX
      this.touchMoveX = deltaX
    },
    onTouchEnd(e: TouchEvent) {
      if (!e.changedTouches[0]) return
      if (!this.isSwiping) return
      this.isSwiping = false
      const deltaX = this.touchMoveX
      if (Math.abs(deltaX) > this.threshold) {
        if (deltaX > 0) {
          this.prev()
        } else {
          this.next()
        }
      } else {
        // Not enough swipe distance, reset position
        this.touchMoveX = 0
      }
    },
    show() {
      const dialog = this.$refs.dialog as QDialog
      dialog.show()
    },
    hide() {
      const dialog = this.$refs.dialog as QDialog
      dialog.hide()
    },
    onDialogHide() {
      this.$emit("hide")
    },
    onOKClick() {
      this.$emit("ok")
      this.hide()
    },
    onCancelClick() {
      this.hide()
    },
  },
})
</script>
