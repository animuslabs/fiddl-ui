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
                      q-item(clickable @click="deleteImage()" v-close-popup v-if="userCreatedImage && allowDelete")
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
            v-if="imgLoading || loading || hdVideoLoading"
            color="primary"
            track-color="transparent"
          )
        div( v-if="type === 'video'" class="video-wrapper")
          video(
            ref="mediaElement"
            :src="currentMediaUrl"
            class="image-darken"
            style="width:100%; max-height:75vh; object-fit:contain; transform:`translateX(${touchMoveX}px)`"
            playsinline
            autoplay
            loop
            @canplay="mediaLoaded"
            @click.stop="onImageClick"
            controls
          )
        img(v-else v-bind="mediaAttrs" ref="mediaElement" style="min-width:30vw;")
        .q-linear-progress.full-width.absolute-bottom(indeterminate color="primary")
        .absolute-top.full-width(style="width:100vw")
          .centered(v-if="hdVideoLoading")
            h6.text-white HD Loading
        //- img.image-darken.absolute-center(
        //-   :src="nextMediaUrl"
        //-   @click.stop="onImageClick"
        //-   alt="user created image"
        //-   style="width:85%; max-height: 75vh; object-fit: contain; z-index: -1;"
        //- ).lt-md
        .row(v-if="!creatorMeta.userName.length && !userOwnsMedia" style="bottom:-0px" @click="goToCreator()").items-center.absolute-bottom
          .col-auto.q-pa-sm.cursor-pointer(style="background-color:rgba(0,0,0,0.5);")
            .row.items-center.q-mb-xs
              q-img(placeholder-src="/blankAvatar.webp" :src="avatarImg(creatorMeta.id||'')" style="width:30px; height:30px; border-radius:50%;").q-mr-sm
              h6.q-mr-sm @{{creatorMeta.userName}}
    .centered
      div.q-mt-md(v-if="localMediaObjects.length > 1 && !downloadMode && localMediaObjects.length < 11")
        span.indicator(v-for="(image, index) in localMediaObjects" :key="index" :class="{ active: index === currentIndex }" @click.stop="goTo(index)")
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
  transition:
    filter 0.3s ease,
    transform 0.3s ease;
  will-change: transform;
}
.image-darken.hd-loaded {
  transform: scale(1.01);
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
/* Ensure videos render at a minimum of 720p and scale up to 1080p where screen space allows */
.video-wrapper {
  max-width: 1920px;
  max-height: 1080px;
  margin: auto;
}
.video-wrapper video {
  /* background-color: black !important; */
  width: 100%;
  height: auto;
  object-fit: contain;
  max-width: 1920px;
  max-height: 1080px;
  margin: auto;
  display: block;
  /* aspect-ratio: 16 / 9; */
}

@media (min-width: 1400px) and (min-height: 800px) {
  .video-wrapper video {
    min-width: 1280px;
    min-height: 720px;
  }
}
</style>
<script lang="ts">
import { Dialog, LocalStorage, QDialog, SessionStorage } from "quasar"
import { defineComponent, PropType, Ref, ref } from "vue"
import {
  collectionsMediaInUsersCollection,
  creationsHdVideo,
  collectionsLikeMedia,
  collectionsUnlikeMedia,
  creationsDeleteMedia,
  creationsGetCreationData,
  userGetUsername,
  creationsHdImage,
  creationsGetImageRequest,
  creationsGetVideoRequest,
  useCreationsHdVideo,
} from "src/lib/orval"
import { avatarImg, img } from "lib/netlifyImg"
import { catchErr, copyToClipboard, getCreationRequest, longIdToShort, preloadHdVideo, shareLink, shareMedia, sleep, throwErr, updateQueryParams } from "lib/util"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import DownloadImage from "./DownloadMedia.vue"
import CreateAvatar from "src/components/dialogs/CreateAvatar.vue"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useBrowserStore } from "src/stores/browserStore"
import { s3Video } from "lib/netlifyImg"
import { useUserAuth } from "src/stores/userAuth"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import EditMedia from "components/dialogs/EditMedia.vue"
import LikeMedia from "./LikeMedia.vue"
import { MediaGalleryMeta } from "src/components/MediaGallery.vue"

export default defineComponent({
  props: {
    mediaObjects: {
      type: Array as () => MediaGalleryMeta[],
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
    allowDelete: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["ok", "hide"],
  data() {
    return {
      hdVideoLoading: false,
      triedHdLoad: false,
      dynamic: false,
      userAuth: useUserAuth(),
      creationStore: useImageCreations(),
      shareMenu: true,
      moreOptionsMenu: true,
      localMediaObjects: [] as MediaGalleryMeta[],
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
    type() {
      const val = this.mediaObjects[this.currentIndex]
      let type = val!.type || "image"
      return type
    },
    dialogParams() {
      return { userOwnsMedia: this.userOwnsMedia, currentMediaId: this.currentMediaId, type: this.type }
    },
    mediaParams() {
      return this.buildMediaParam()
    },
    currentMediaUrl() {
      return this.getMediaUrl(this.currentMediaId)
    },
    nextMediaUrl() {
      if (this.localMediaObjects.length === 1) return this.currentMediaUrl
      const nextIndex = this.touchMoveX > 0 ? (this.currentIndex - 1 + this.localMediaObjects.length) % this.localMediaObjects.length : (this.currentIndex + 1) % this.localMediaObjects.length
      const id = this.localMediaObjects[nextIndex]!.id as string
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
          controls: false,
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
      if (this.localMediaObjects.length === 0) return ""
      return this.localMediaObjects[this.currentIndex]!.id as string
    },
  },
  watch: {
    currentIndex: {
      handler() {
        // this.preloadMedia()
        // void this.loadRequestId()
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
        this.hdVideoLoading = false
        this.hdMediaLoaded = false
        this.triedHdLoad = false
        this.userLikedMedia = false
        this.userOwnsMedia = false
        this.loadingLike = true
        const response = await collectionsMediaInUsersCollection({ ...this.mediaParams, name: "likes" })
        console.log(response.data)
        this.userLikedMedia = response?.data
        this.loadingLike = false
        void this.loadRequestId()
        await this.loadHdMedia()
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
  async mounted() {
    this.localMediaObjects = [...this.mediaObjects]
    this.currentIndex = this.startIndex
    // this.preloadMedia()
    window.addEventListener("keydown", this.handleKeyDown)
    this.dynamic = true
    // // await this.loadRequestId()
    // // await this.loadHdMedia()
    if (this.type == "video") {
      const video = this.$refs.mediaElement as HTMLVideoElement
      void video.play().catch((err) => {
        console.info(err)
        video.muted = true
        void video.play()
      })
    }
  },
  methods: {
    async loadHdMedia(val?: string) {
      this.imgLoading = false
      if (!val) val = this.currentMediaId
      if (!this.userAuth.loggedIn) return
      if (this.triedHdLoad || this.hdMediaLoaded) return
      this.triedHdLoad = true
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
          if (!imageData && !SessionStorage.getItem(`noHd${this.type}-` + val)) {
            const hdResponse = await Promise.race([
              creationsHdImage({ imageId: val }).catch(() => {
                SessionStorage.setItem(`noHd${this.type}-` + val, true)
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
            const mediaEl = this.$refs.mediaElement as HTMLImageElement
            mediaEl.classList.add("hd-loaded")

            if (mediaEl && mediaEl.tagName.toLowerCase() === "img") {
              mediaEl.src = dataUrl
            }
          }
        } else if (this.type === "video") {
          const { data: hdUrl } = await creationsHdVideo({ videoId: val })
          if (!hdUrl) return
          LocalStorage.setItem("hdVideoUrl-" + val, hdUrl)
          const player = this.$refs.mediaElement as HTMLVideoElement | undefined
          if (!player) return

          const resumeAt = player.currentTime
          const wasPlaying = !player.paused

          const tempVideo = document.createElement("video")
          this.hdVideoLoading = true
          tempVideo.src = hdUrl
          tempVideo.preload = "auto"
          tempVideo.muted = true // Required for autoplay on some browsers
          tempVideo.oncanplaythrough = () => {
            player.src = hdUrl
            player.load()
            this.hdVideoLoading = false
            // player.currentTime = resumeAt
            if (wasPlaying) player.play().catch(() => {})
          }
          // tempVideo.on
          this.hdMediaLoaded = true
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
      // console.log("building media param:", val)
      return this.type === "video" ? { videoId: val } : { imageId: val }
    },
    getMediaUrl(id: string): string {
      if (this.type == "image") return img(id, "lg")
      const cached = LocalStorage.getItem<string>("hdVideoUrl-" + id)
      if (cached) {
        this.hdMediaLoaded = true
        this.userOwnsMedia = true
        this.triedHdLoad = true
        return cached
      } else return s3Video(id, "preview-lg")
      // return this.type === "video" ? s3Video(id, "preview"hdVideoUrl-" + id-lg") : img(id, "lg")
    },
    deleteImage() {
      Dialog.create({
        title: "Delete Creation",
        message: "Are you sure you want to delete this creation?",
        ok: { label: "Delete", color: "negative" },
        cancel: { label: "Cancel", color: "primary" },
      }).onOk(async () => {
        this.loading = true
        this.imageDeleted = true
        await this.loadRequestId()
        const requestId = this.loadedRequestId
        const deletedId = this.currentMediaId
        try {
          await creationsDeleteMedia(this.buildMediaParam())
        } catch (error) {
          catchErr(error)
        }

        // Remove deleted media
        this.localMediaObjects = this.localMediaObjects.filter((el) => el.id !== deletedId)

        // 🚨 If no media left, exit early
        if (this.localMediaObjects.length === 0) {
          this.hide()
          // return
        }

        // ✅ Adjust index safely
        if (this.currentIndex >= this.localMediaObjects.length) {
          this.currentIndex = this.localMediaObjects.length - 1
        }

        setTimeout(() => {
          this.loading = false
        }, 500)

        if (requestId) {
          console.log("req id")
          if (this.type == "image") {
            useImageCreations().deleteImage(deletedId, requestId)
            useBrowserStore().removeMedia(deletedId)
          } else {
            useVideoCreations().deleteVideo(deletedId, requestId)
          }
        } else {
          // await this.loadRequestId()
        }
      })
    },
    async loadRequestId() {
      // return
      if (!this.dynamic && this.requestId && this.creatorMeta.userName.length) return
      const imageResponse = await creationsGetCreationData(this.buildMediaParam()).catch(catchErr)
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
      Dialog.create({ component: CreateAvatar, componentProps: this.dialogParams })
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
          component: LikeMedia,
          componentProps: this.dialogParams,
        }).onOk(() => {
          // When the user completes the purchase in LikeImage dialog
          // Refresh image ownership status and like the image
          this.triedHdLoad = false
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
      Dialog.create({ component: EditMedia, componentProps: this.dialogParams })
      // .onOk(() => {
      //   void this.$router.push({ name: "create", query: { mediaId: this.currentMediaId, type: this.type } })
      //   this.hide()
      // })
      // if (this.userOwnsMedia) {
      //   void this.$router.push({ name: "create", query: { mediaId: this.currentMediaId, type: this.type } })
      //   this.hide()
      // } else {
      //   Dialog.create({ component: EditMedia, componentProps: this.dialogParams }).onOk(() => {
      //     void this.$router.push({ name: "create", query: { mediaId: this.currentMediaId, type: this.type } })
      //     this.hide()
      //   })
      // }
    },
    showDownloadWindow() {
      Dialog.create({ component: DownloadImage, componentProps: { ...this.dialogParams, requestId: this.loadedRequestId } }).onDismiss(() => {
        this.triedHdLoad = false
        this.hdMediaLoaded = false

        this.imgLoading = true
        void this.loadHdMedia()
      })
    },
    preloadMedia() {
      const preloadIndices = [this.currentIndex - 1, this.currentIndex + 1]
      preloadIndices.forEach((index) => {
        if (index >= 0 && index < this.localMediaObjects.length) {
          const mediaObj = this.localMediaObjects[index]
          if (!mediaObj) return
          const isVideo = mediaObj.type === "video"
          const url = isVideo ? s3Video(mediaObj.id, "preview-lg") : img(mediaObj.id, "lg")
          if (isVideo) {
            const video = document.createElement("video")
            video.preload = "auto"
            video.src = url
            video.load()
          } else {
            const imgElement = new Image()
            imgElement.src = url
          }
        }
      })
    },
    async mediaLoaded(event: Event) {
      // if (this.hdMediaLoaded || this.loading) return // 🔒 prevent loop

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
        if (!this.hdMediaLoaded) {
          await this.loadHdMedia()
        }
        this.imgLoading = false
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
      try {
        let params: any = { requestShortId: "", type: this.type, index: 0 }
        let query: any = {}
        let localRequestId = this.requestId
        console.log("sharing", localRequestId)
        if (!localRequestId) {
          const { data } = await creationsGetCreationData(this.mediaParams)
          localRequestId = data.requestId
        }
        params.requestShortId = longIdToShort(localRequestId)
        params.type = this.type
        const requestData = await getCreationRequest(localRequestId, this.type)
        const mediaIndex = requestData.mediaIds.findIndex((el: string) => el == this.currentMediaId) || 0
        params.index = mediaIndex
        let hasUsername = !!(this.userAuth.loggedIn && this.userAuth.userProfile?.username)
        if (!hasUsername && this.userAuth.loggedIn) await this.userAuth.loadUserProfile()
        hasUsername = !!this.userAuth.userProfile?.username
        if (hasUsername) query.referredBy = this.userAuth.userProfile?.username
        const url = this.$router.resolve({ name: "mediaRequest", params, query }).href
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
    },
    openDialog(startingIndex = 0) {
      this.currentIndex = startingIndex
      this.isFullScreen = true
    },
    next() {
      if (this.localMediaObjects.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex + 1) % this.localMediaObjects.length
      this.touchMoveX = 0 // Reset movement
    },
    prev() {
      if (this.localMediaObjects.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex - 1 + this.localMediaObjects.length) % this.localMediaObjects.length
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
      if (this.mediaObjects.length === 1) return (this.touchMoveX = 0)
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
