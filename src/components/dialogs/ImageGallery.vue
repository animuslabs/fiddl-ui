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
                    p(v-else) Download Image
              q-btn(icon="edit" flat round @click.native.stop="editImage()" :color="editBtnColor")
              q-btn(icon="sym_o_favorite" flat round @click.native.stop="likeImage()" :color="favoriteBtnColor" :loading="loadingLike")
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
                      q-item(clickable @click="setProfileImage()" v-close-popup)
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
          q-linear-progress.absolute-top.full-width(
            style="top:-2px;"
            indeterminate
            v-if="imgLoading || loading"
            color="teal-9"
            track-color="transparent"
          )
        // Image with transform binding
        img.image-darken(
          :src="currentImageUrl"
          @click.native.stop="onImageClick"
          ref="overlayImage"
          @load="imgLoaded"
          alt="user created image"
          style="width:100%; max-height: 75vh; object-fit: contain;"
          :class="imgClass"
          :style="{ transform: 'translateX(' + touchMoveX + 'px)' }"
        )
        img.image-darken.absolute-center(
          :src="nextImageUrl"
          @click.native.stop="onImageClick"
          @load="imgLoaded"
          alt="user created image"
          style="width:85%; max-height: 75vh; object-fit: contain; z-index: -1;"
        ).lt-md
        .row(v-if="creatorMeta.value && !userOwnsImage" style="bottom:-0px" @click="goToCreator()").items-center.absolute-bottom
          .col-auto.q-pa-sm.cursor-pointer(style="background-color:rgba(0,0,0,0.5);")
            .row.items-center.q-mb-xs
              q-img(placeholder-src="/blankAvatar.webp" :src="avatarImg(creatorMeta.value?.id||'')" style="width:30px; height:30px; border-radius:50%;").q-mr-sm
              h6.q-mr-sm @{{creatorMeta.value?.username}}
    .centered
      div.q-mt-md(v-if="localImageIds.length > 1 && !downloadMode && localImageIds.length < 11")
        span.indicator(v-for="(image, index) in localImageIds" :key="index" :class="{ active: index === currentIndex }" @click.native.stop="goTo(index)")
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
  transition: filter 0.5s ease;
}
.image-darken.active {
  filter: brightness(50%);
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
import { avatarImg, img } from "lib/netlifyImg"
import { catchErr, copyToClipboard, longIdToShort, shareImage, updateQueryParams } from "lib/util"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import DownloadImage from "./DownloadImage.vue"
import EditImage from "./EditImage.vue"
import LikeImage from "./LikeImage.vue"
import CreateAvatar from "src/components/dialogs/CreateAvatar.vue"
import { useCreations } from "src/stores/creationsStore"
import { useBrowserStore } from "src/stores/browserStore"

export default defineComponent({
  props: {
    imageIds: {
      type: Array as () => string[],
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
    creatorMeta: {
      type: Object as PropType<Ref<{ id: string; username: string } | null>>,
      default: ref(null),
    },
  },
  emits: ["ok", "hide"],
  data() {
    return {
      dynamic: false,
      creationStore: useCreations(),
      shareMenu: true,
      moreOptionsMenu: true,
      localImageIds: [] as string[],
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
    }
  },
  computed: {
    nextImageUrl() {
      if (this.localImageIds.length === 1) return this.currentImageUrl
      if (!this.touchMoveX) return this.currentImageUrl
      // if touchMoveX is positive, show previous image
      // if touchMoveX is negative, show next image
      const nextIndex = this.touchMoveX > 0 ? (this.currentIndex - 1 + this.localImageIds.length) % this.localImageIds.length : (this.currentIndex + 1) % this.localImageIds.length
      const nextImage = this.localImageIds[nextIndex]
      if (!nextImage) return this.currentImageUrl
      return img(nextImage, "lg")
    },
    currentImageUrl() {
      return img(this.currentImageId, "lg")
    },
    userCreatedImage() {
      if (!this.creatorMeta.value) return false
      return this.creatorMeta.value.id == this.$userAuth.userId
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
    currentImageId() {
      if (this.localImageIds.length === 0) return ""
      return this.localImageIds[this.currentIndex] as string
    },
  },
  watch: {
    currentIndex: {
      handler() {
        this.preloadImages()
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
    currentImageId: {
      async handler(val: string) {
        if (!this.$userAuth.loggedIn) return
        this.hdImageLoaded = false // Reset HD image loaded flag
        this.userLikedImage = false
        this.loadingLike = true
        this.userLikedImage = await this.$api.collections.imageInUsersCollection.query({ imageId: val, name: "likes" })
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
    this.localImageIds = [...this.imageIds]
    this.currentIndex = this.startIndex
    this.preloadImages()
    window.addEventListener("keydown", this.handleKeyDown)
    if (!this.creatorMeta.value || !this.imageRequestId) {
      this.dynamic = true
    }
    void this.loadRequestId()
  },
  methods: {
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
        void this.$api.creations.deleteImage.mutate(this.currentImageId).catch(catchErr)
        if (this.localImageIds.length == 1) this.hide()
        this.localImageIds = this.localImageIds.filter((el) => el !== this.currentImageId)
        if (this.currentIndex >= this.localImageIds.length - 2) this.currentIndex--
        setTimeout(() => {
          this.loading = false
        }, 500)
        await this.loadRequestId()
        if (!this.loadedRequestId) return
        useCreations().deleteImage(this.currentImageId, this.loadedRequestId)
        useBrowserStore().deleteImage(this.currentImageId, this.loadedRequestId)
      })
    },
    async loadRequestId() {
      if (!this.dynamic && this.imageRequestId && this.creatorMeta.value) return
      const imageMeta = await this.$api.creations.imageData.query(this.currentImageId).catch(catchErr)
      if (!imageMeta) return
      this.loadedRequestId = imageMeta.imageRequestId
      const creatorName = (await this.$api.user.getUsername.query(imageMeta.creatorId).catch(catchErr)) || ""
      this.creatorMeta.value = { id: imageMeta.creatorId, username: creatorName }
    },
    goToCreator() {
      if (!this.creatorMeta.value) return
      void this.$router.push({ name: "profile", params: { username: this.creatorMeta.value?.username } })
    },
    setProfileImage() {
      Dialog.create({ component: CreateAvatar, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentImageId } })
    },
    goToRequestPage() {
      if (!this.loadedRequestId || this.loadedRequestId.length == 0) return
      this.hide()
      void this.$router.push({ name: "imageRequest", params: { requestShortId: longIdToShort(this.loadedRequestId) } })
    },
    likeImage() {
      if (!this.userOwnsImage) {
        Dialog.create({ component: LikeImage, componentProps: { currentImageId: this.currentImageId } })
          .onOk(async () => {
            await this.loadHdImage()
            this.likeImage()
          })
          .onCancel(() => {
            this.hide()
          })
      } else {
        this.userLikedImage = !this.userLikedImage
        if (this.userLikedImage) void this.$api.collections.likeImage.mutate(this.currentImageId)
        else void this.$api.collections.unlikeImage.mutate(this.currentImageId)
      }
    },
    editImage() {
      if (this.userOwnsImage) {
        void this.$router.push({ name: "create", query: { imageId: this.currentImageId } })
        this.hide()
      } else {
        Dialog.create({ component: EditImage, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentImageId } }).onOk(() => {
          void this.$router.push({ name: "create", query: { imageId: this.currentImageId } })
          this.hide()
        })
      }
    },
    showDownloadWindow() {
      Dialog.create({ component: DownloadImage, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentImageId } }).onDismiss(() => {
        // After purchase or download
        this.hdImageLoaded = false // Reset HD image loaded flag
        this.imgLoading = true
        void this.loadHdImage()
      })
    },
    async loadHdImage(val?: string) {
      if (!val) val = this.currentImageId
      if (!this.$userAuth.loggedIn) return
      this.userOwnsImage = false

      let timer: any | null = null
      const timeoutPromise = new Promise<null>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Image loading timed out"))
          this.loading = false
          this.imgLoading = false
        }, 6000) // Set timeout duration (e.g., 6 seconds)
      })

      try {
        let imageData = await getImageFromCache(val)
        console.log("hd image cached:", !!imageData)
        if (!imageData) {
          if (SessionStorage.getItem("noHdImage-" + val)) return
          this.loading = true
          imageData =
            (await Promise.race([
              this.$api.creations.hdImage.query(val).catch(() => {
                SessionStorage.setItem("noHdImage-" + val, true)
              }),
              timeoutPromise,
            ])) || undefined
          if (!imageData) return
          await storeImageInCache(val, imageData)
        }
        this.userOwnsImage = true
        const imageDataUrl = `data:image/webp;base64,${imageData}`
        void this.$nextTick(() => {
          console.log("Loaded hd image")
          const img = this.$refs.overlayImage as HTMLImageElement
          if (img) img.src = imageDataUrl
          // Do not set hdImageLoaded here
        })
      } catch (err) {
        console.error("Failed to load image:", err)
      } finally {
        if (timer) clearTimeout(timer) // Clear the timer on success or failure
        this.loading = false
      }
    },

    preloadImages() {
      const preloadIndices = [this.currentIndex - 1, this.currentIndex + 1]
      preloadIndices.forEach((index) => {
        if (index >= 0 && index < this.localImageIds.length) {
          const imageId = this.localImageIds[index]
          if (!imageId) return
          const imgSrc = img(imageId, "lg")
          const imgElement = new Image()
          imgElement.src = imgSrc
        }
      })
    },
    async imgLoaded(event: Event) {
      const imgElement = event.target as HTMLImageElement
      if (imgElement.src.startsWith("data:image/")) {
        // HD image has loaded
        this.hdImageLoaded = true
        this.imgLoading = false
      } else {
        // Low-res image has loaded
        if (!this.hdImageLoaded) {
          await this.loadHdImage()
        }
        this.imgLoading = false
      }

      this.firstImageLoaded = true
      if (!this.preloaded) {
        this.preloaded = true
        this.preloadImages()
        await this.loadRequestId()
      }
    },
    async mobileShare() {
      await shareImage("Fiddl.art Creation", "Check out this creation on Fiddl.art", this.currentImageUrl, this.currentImageId + "-fiddl-art.webp")
    },
    async share() {
      let params: any = { requestShortId: "" }
      let query: any = { index: this.currentIndex }
      let imageRequestId = this.imageRequestId
      if (!imageRequestId) {
        const imageMeta = await this.$api.creations.imageData.query(this.currentImageId).catch(catchErr)
        if (!imageMeta) return
        imageRequestId = imageMeta.imageRequestId
        params.requestShortId = longIdToShort(imageRequestId)
      } else {
        params.requestShortId = longIdToShort(imageRequestId)
      }
      const request = await this.$api.creations.createRequest.query(imageRequestId)
      const imageIndex = request.imageIds.findIndex((el) => el == this.currentImageId) || 0
      query.index = imageIndex
      await this.$userAuth.loadUserProfile()
      const hasUsername = !!(this.$userAuth.loggedIn && this.$userAuth.userProfile?.username)
      if (hasUsername) query.referredBy = this.$userAuth.userProfile?.username
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
      if (this.localImageIds.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex + 1) % this.localImageIds.length
      this.touchMoveX = 0 // Reset movement
    },
    prev() {
      if (this.localImageIds.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex - 1 + this.localImageIds.length) % this.localImageIds.length
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
      if (this.imageIds.length === 1) return (this.touchMoveX = 0)
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
