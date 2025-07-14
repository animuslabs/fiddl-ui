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
                  @click.native.stop="shareMenu = true"
                )
                  q-menu(
                    v-if="shareMenu"
                    anchor="bottom left"
                    self="top left"
                    @click.native.stop="shareMenu = false"
                  )
                    q-list
                      q-item(clickable @click.native.stop="mobileShare()" v-close-popup)
                        q-item-section
                          .row.items-center
                            q-icon(name="image" size="20px").q-mr-md
                            div Share Image
                      q-item(clickable @click="share()" v-close-popup)
                        q-item-section
                          .row.items-center
                            q-icon(name="content_copy" size="20px").q-mr-md
                            div Copy Link
              q-btn(icon="sym_o_info" flat round @click.native.stop="goToRequestPage()" color="grey-5" v-if="loadedRequestId")
              div
                q-btn(icon="download" flat @click.native.stop="showDownloadWindow()" round :class="downloadClass")
                  q-tooltip
                    p(v-if="userOwnsImage") You own the 4k download
                    p(v-else).text-capitalize Download {{ type }}
              q-btn(icon="edit" flat round @click.native.stop="editImage()" :color="editBtnColor")
              q-btn(icon="sym_o_favorite" flat round @click.native.stop="toggleLike()" :color="favoriteBtnColor" :loading="loadingLike")
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
                    @click.native.stop="moreOptionsMenu = false"
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
                q-btn(icon="close" flat @click.native.stop="hide" round color="grey-5")
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
        // Image with transform binding
        //- img.image-darken(
        //-   :src="currentImageUrl"
        //-   @click.native.stop="onImageClick"
        //-   ref="overlayImage"
        //-   @load="imgLoaded"
        //-   alt="user created image"
        //-   style="width:100%; max-height: 75vh; object-fit: contain;"
        //-   :class="imgClass"
        //-   :style="{ transform: 'translateX(' + touchMoveX + 'px)' }"
        //- )
        component( :is="type === 'video' ? 'video' : 'img'" v-bind="mediaAttrs")
        img.image-darken.absolute-center(
          :src="nextImageUrl"
          @click.native.stop="onImageClick"
          alt="user created image"
          style="width:85%; max-height: 75vh; object-fit: contain; z-index: -1;"
        ).lt-md
        .row(v-if="!creatorMeta.userName.length && !userOwnsImage" style="bottom:-0px" @click="goToCreator()").items-center.absolute-bottom
          .col-auto.q-pa-sm.cursor-pointer(style="background-color:rgba(0,0,0,0.5);")
            .row.items-center.q-mb-xs
              q-img(placeholder-src="/blankAvatar.webp" :src="avatarImg(creatorMeta.id||'')" style="width:30px; height:30px; border-radius:50%;").q-mr-sm
              h6.q-mr-sm @{{creatorMeta.userName}}
    .centered
      div.q-mt-md(v-if="localMediaIds.length > 1 && !downloadMode && localMediaIds.length < 11")
        span.indicator(v-for="(image, index) in localMediaIds" :key="index" :class="{ active: index === currentIndex }" @click.native.stop="goTo(index)")
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
import { collectionsMediaInUsersCollection, creationsHdVideo, collectionsLikeImage, collectionsUnlikeImage, creationsDeleteMedia, creationsGetCreationData, userGetUsername, creationsHdImage, creationsCreateRequest } from "src/lib/orval"
import { avatarImg, img } from "lib/netlifyImg"
import { catchErr, copyToClipboard, longIdToShort, shareImage, updateQueryParams } from "lib/util"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import DownloadImage from "./DownloadImage.vue"
import EditImage from "./EditImage.vue"
import LikeImage from "./LikeImage.vue"
import CreateAvatar from "src/components/dialogs/CreateAvatar.vue"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useBrowserStore } from "src/stores/browserStore"
import { s3Video } from "lib/netlifyImg"
import { useUserAuth } from "src/stores/userAuth"

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
    imageRequestId: {
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
      userOwnsImage: false,
      loading: false,
      currentIndex: 0,
      isFullScreen: false,
      touchStartX: 0,
      touchMoveX: 0, // Added to track horizontal movement
      isSwiping: false, // Indicates if a swipe is in progress
      threshold: 50, // Minimum swipe distance to trigger navigation
      firstImageLoaded: false,
      upscaling: false,
      userLikedImage: false,
      loadingLike: false,
      loadedRequestId: null as string | null,
      hdImageLoaded: false, // Added flag
      creatorMeta: {
        userName: "",
        id: "",
      },
    }
  },
  computed: {
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
          src: this.currentImageUrl,
          playsinline: true,
          autoplay: true,
          muted: true,
          loop: true,
          controls: true,
          onCanplay: (e: Event) => this.mediaLoaded(e),
        }
      }

      return {
        ...base,
        src: this.currentImageUrl,
        ref: "overlayImage",
        onLoad: (e: Event) => this.mediaLoaded(e),
        alt: "user created image",
        class: this.imgClass,
      }
    },
    nextImageUrl() {
      if (this.localMediaIds.length === 1) return this.currentImageUrl
      if (!this.touchMoveX) return this.currentImageUrl
      // if touchMoveX is positive, show previous image
      // if touchMoveX is negative, show next image
      const nextIndex = this.touchMoveX > 0 ? (this.currentIndex - 1 + this.localMediaIds.length) % this.localMediaIds.length : (this.currentIndex + 1) % this.localMediaIds.length
      const nextImage = this.localMediaIds[nextIndex]
      if (!nextImage) return this.currentImageUrl
      return this.getMediaUrl(nextImage)
    },
    currentImageUrl() {
      return this.getMediaUrl(this.currentMediaId)
    },
    userCreatedImage() {
      if (!this.creatorMeta) return false
      return this.creatorMeta.id == this.userAuth.userId
    },
    imgClass() {
      if (!this.firstImageLoaded) return ""
      else return this.loading || this.imgLoading ? "image-darken active" : "image-darken"
    },
    favoriteBtnColor() {
      return this.userLikedImage ? "accent" : this.userOwnsImage ? "grey-5" : "grey-6"
    },
    editBtnColor() {
      return this.userOwnsImage ? "primary" : "grey-6"
    },
    downloadClass() {
      return this.userOwnsImage ? "text-primary" : "text-grey-6"
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
    imageRequestId: {
      handler(val: string) {
        if (!val) return
        this.loadedRequestId = val
      },
      immediate: true,
    },
    currentMediaId: {
      async handler(val: string) {
        if (!this.userAuth.loggedIn) return
        this.hdImageLoaded = false // Reset HD image loaded flag
        this.userLikedImage = false
        this.loadingLike = true
        const response = await collectionsMediaInUsersCollection({ ...this.buildMediaParam(val), name: "likes" })
        this.userLikedImage = response?.data
        this.loadingLike = false
        if (this.$route.name == "imageRequest") {
          const query = { index: this.currentIndex }
          const newQuery = { ...this.$route.query, ...query }
          void this.$nextTick(() => {
            updateQueryParams(newQuery)
          })
        }
      },
      immediate: true,
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
    if (!this.creatorMeta.userName.length || !this.imageRequestId) {
      this.dynamic = true
    }
    void this.loadRequestId()
  },
  methods: {
    async loadHdMedia(val?: string) {
      this.imgLoading = false
      if (!val) val = this.currentMediaId
      if (!this.userAuth.loggedIn) return
      this.userOwnsImage = false

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
            this.userOwnsImage = true
            const dataUrl = `data:image/webp;base64,${imageData}`
            await this.$nextTick()
            const img = this.$refs.overlayImage as HTMLImageElement
            if (img) img.src = dataUrl
          }
        } else if (this.type === "video") {
          const hdUrl = await Promise.race([creationsHdVideo({ videoId: val }).catch(() => null), timeoutPromise])
          if (hdUrl?.data) {
            this.userOwnsImage = true
            await this.$nextTick()
            const video = this.$el.querySelector("video") as HTMLVideoElement
            console.log("found video element:", video)
            if (video) video.src = hdUrl.data
          }
        }
      } catch (err) {
        console.error("Failed to load HD media:", err)
      } finally {
        if (timer) clearTimeout(timer)
        this.loading = false
      }
    },
    buildMediaParam(id: string) {
      return this.type === "video" ? { videoId: id } : { imageId: id }
    },
    getMediaUrl(id: string): string {
      return this.type === "video" ? s3Video(`previewVideos/${id}/watermarked.webm`) : img(id, "lg")
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
      if (!this.dynamic && this.imageRequestId && this.creatorMeta.userName.length) return
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
      Dialog.create({ component: CreateAvatar, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentMediaId } })
    },
    goToRequestPage() {
      if (!this.loadedRequestId || this.loadedRequestId.length == 0) return
      this.hide()
      void this.$router.push({ name: "imageRequest", params: { requestShortId: longIdToShort(this.loadedRequestId) } })
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

      if (!this.userOwnsImage) {
        // Show LikeImage dialog for users who don't own the image
        Dialog.create({
          component: LikeImage,
          componentProps: {
            userOwnsImage: this.userOwnsImage,
            currentImageId: this.currentMediaId,
          },
        }).onOk(() => {
          // When the user completes the purchase in LikeImage dialog
          // Refresh image ownership status and like the image
          void this.loadHdMedia(this.currentMediaId)
          this.userLikedImage = true
          collectionsLikeImage({ imageId: this.currentMediaId }).catch(catchErr)
        })
        return
      }

      // Toggle like status for owned images
      this.userLikedImage = !this.userLikedImage

      try {
        if (this.userLikedImage) {
          await collectionsLikeImage({ imageId: this.currentMediaId })
        } else {
          await collectionsUnlikeImage({ imageId: this.currentMediaId })
        }
      } catch (error) {
        // Revert UI state if API call fails
        this.userLikedImage = !this.userLikedImage
        catchErr(error)
      }
    },
    editImage() {
      if (this.userOwnsImage) {
        void this.$router.push({ name: "create", query: { imageId: this.currentMediaId } })
        this.hide()
      } else {
        Dialog.create({ component: EditImage, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentMediaId } }).onOk(() => {
          void this.$router.push({ name: "create", query: { imageId: this.currentMediaId } })
          this.hide()
        })
      }
    },
    showDownloadWindow() {
      Dialog.create({ component: DownloadImage, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentMediaId } }).onDismiss(() => {
        // After purchase or download
        this.hdImageLoaded = false // Reset HD image loaded flag

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
          }
        }
      })
    },
    async mediaLoaded(event: Event) {
      const el = event.target as HTMLImageElement | HTMLVideoElement
      const isImage = this.type === "image"

      console.log("media loaded:", el)

      if (isImage) {
        const imgEl = el as HTMLImageElement
        if (imgEl.src.startsWith("data:image/")) {
          this.hdImageLoaded = true
          this.imgLoading = false
        } else {
          if (!this.hdImageLoaded) {
            await this.loadHdMedia()
          }
          this.imgLoading = false
        }
      } else {
        // type === 'video'
        this.imgLoading = false
        this.hdImageLoaded = true
      }

      this.firstImageLoaded = true

      if (!this.preloaded) {
        this.preloaded = true
        this.preloadMedia()
        await this.loadRequestId()
      }
    },
    async mobileShare() {
      await shareImage("Fiddl.art Creation", "Check out this creation on Fiddl.art", this.currentImageUrl, `${this.currentMediaId}-fiddl-art.${this.type === "video" ? "webm" : "webp"}`)
    },
    async share() {
      let params: any = { requestShortId: "" }
      let query: any = { index: this.currentIndex }
      let imageRequestId = this.imageRequestId
      if (!imageRequestId) {
        const imageResponse = await creationsGetCreationData(this.buildMediaParam(this.currentMediaId)).catch(catchErr)
        const imageMeta = imageResponse?.data
        if (!imageMeta) return
        imageRequestId = imageMeta.requestId
        params.requestShortId = longIdToShort(imageRequestId)
      } else {
        params.requestShortId = longIdToShort(imageRequestId)
      }
      const requestResponse = await creationsCreateRequest({ requestId: imageRequestId })
      const request = requestResponse?.data as any
      if (!request) return
      const imageIndex = request.imageIds?.findIndex((el: string) => el == this.currentMediaId) || 0
      query.index = imageIndex
      await this.userAuth.loadUserProfile()
      const hasUsername = !!(this.userAuth.loggedIn && this.userAuth.userProfile?.username)
      if (hasUsername) query.referredBy = this.userAuth.userProfile?.username
      const url = this.$router.resolve({ name: "imageRequest", params, query }).href
      const fullUrl = window.location.origin + url
      copyToClipboard(fullUrl)
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
