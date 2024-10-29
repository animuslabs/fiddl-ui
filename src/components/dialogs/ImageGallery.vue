<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" maximized persistent )
  q-card.q-dialog-plugin(style="width:90vw;" @click="hide()").bg-transparent
    .full-width(style="height:5vh").gt-sm
    .relative-position
      //- q-spinner.absolute-center(size="100px")
      .centered.q-mb-md.q-mt-lg.relative-position(:style="{visibility: downloadMode ? 'hidden' : 'visible'}")
        div
          q-btn(icon="share"  flat @click.native.stop="share()" round color="grey-5")
        q-btn(icon="sym_o_info" flat round @click.native.stop="goToRequestPage()" color="grey-5" v-if="imageRequestId.length != 0")
        div
          q-btn(icon="download"  flat @click.native.stop="showDownloadWindow()" round :class="downloadClass")
            q-tooltip
              p(v-if="userOwnsImage") You own the 4k download
              p(v-else) Download Image
        q-btn(icon="sym_o_edit" flat round @click.native.stop="editImage()" color="grey-5")
        q-btn(icon="sym_o_favorite" flat round @click.native.stop="likeImage()" :color="favoriteBtnColor" :loading="loadingLike")
        //- q-btn(icon="add" flat @click="closeFullScreen")
        div
          q-btn(icon="close" flat @click.native.stop="hide" round color="grey-5")
      //- q-img.overlay-image(:src="images[currentIndex]" alt="Full Screen Image"  no-transition @click="onImageClick" ref="overlayImage")
      .absolute.full-width.full-height(style="background-color: rgba(0,0,0,.5);" v-if="imgLoading")
    .centered
      div.relative-position
        q-linear-progress.absolute-top.full-width( indeterminate v-if="imgLoading || loading" )
        img(:src="imageUrls[currentIndex]" @click.native.stop="onImageClick" ref="overlayImage" @load="imgLoaded" alt="user created image" style="width:100%; max-height: 75vh; object-fit: contain;")
    .centered
        div.q-mt-md(v-if="imageUrls.length > 1 && !downloadMode")
          span.indicator( v-for="(image, index) in imageUrls" :key="index" :class="{ active: index === currentIndex }" @click.native.stop="goTo(index)")
</template>

<script lang="ts">
import { log } from "console"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import { catchErr, copyToClipboard, downloadFile, downloadImage, extractImageId, generateShortHash, longIdToShort } from "lib/util"
import { Dialog, Loading, QDialog, SessionStorage } from "quasar"
import { defineComponent } from "vue"
import DownloadImage from "./DownloadImage.vue"
import { img } from "lib/netlifyImg"
import EditImage from "./EditImage.vue"
import LikeImage from "./LikeImage.vue"

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
  },
  emits: ["ok", "hide"],
  data() {
    return {
      preloaded: false,
      downloadMode: false,
      imgLoading: true,
      userOwnsImage: false,
      loading: false,
      currentIndex: 0,
      isFullScreen: false,
      touchStartX: 0,
      touchEndX: 0,
      upscaling: false,
      threshold: 50, // Minimum swipe distance
      imageUrls: [] as string[],
      userLikedImage: false,
      loadingLike: false,
    }
  },
  computed: {
    favoriteBtnColor() {
      return this.userLikedImage ? "accent" : "grey-5"
    },
    downloadClass() {
      return this.userOwnsImage ? "text-positive" : "grey-5"
    },
    currentImageId() {
      if (this.imageIds.length === 0) return ""
      return this.imageIds[this.currentIndex] as string
    },
  },
  watch: {
    currentImageId: {
      async handler(val: string) {
        if (!this.$userAuth.loggedIn) return
        this.userLikedImage = false
        this.loadingLike = true
        this.userLikedImage = await this.$api.collections.imageInUsersCollection.query({ imageId: val, name: "likes" })
        this.loadingLike = false
        // void this.$router.replace({ query: { index: this.currentIndex } })
      },
      immediate: true,
    },
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown)
  },
  mounted() {
    this.currentIndex = this.startIndex
    this.imageUrls = this.imageIds.map((el) => img(el, "lg"))
    this.preloadImages()
    window.addEventListener("keydown", this.handleKeyDown)
  },
  methods: {
    goToRequestPage() {
      if (!this.imageRequestId || this.imageRequestId.length == 0) return
      this.hide()
      void this.$router.push({ name: "imageRequest", params: { requestShortId: longIdToShort(this.imageRequestId) } })
    },
    likeImage() {
      // if (!this.$userAuth.loggedIn) return
      if (!this.userOwnsImage) {
        Dialog.create({ component: LikeImage, componentProps: { currentImageId: this.currentImageId } }).onOk(async () => {
          await this.loadHdImage() // this will set userOwnsImage to true
          this.likeImage()
        })
      } else {
        this.userLikedImage = !this.userLikedImage
        if (this.userLikedImage) this.$api.collections.likeImage.mutate(this.currentImageId)
        else this.$api.collections.unlikeImage.mutate(this.currentImageId)
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
        void this.loadHdImage()
      })
    },
    async loadHdImage(val?: string) {
      if (!val) val = this.currentImageId
      if (!this.$userAuth.loggedIn) return
      this.userOwnsImage = false
      let imageData = getImageFromCache(val)
      if (!imageData) {
        if (SessionStorage.getItem("noHdImage-" + val)) return
        this.loading = true
        imageData =
          (await this.$api.creations.hdImage.query(val).catch(() => {
            SessionStorage.setItem("noHdImage-" + val, true)
          })) || undefined
        this.loading = false
        if (!imageData) return
        storeImageInCache(val, imageData)
      }
      this.userOwnsImage = true
      const imageDataUrl = `data:image/webp;base64,${imageData}`
      void this.$nextTick(() => {
        const img = this.$refs.overlayImage as HTMLImageElement
        if (img) img.src = imageDataUrl
      })
    },
    preloadImages() {
      this.imageUrls.forEach((src, index) => {
        if (index !== this.currentIndex) {
          const img = new Image()
          img.src = src
        }
      })
    },
    async imgLoaded(event: Event) {
      await this.loadHdImage()
      if (this.preloaded) return
      this.preloaded = true
      // console.log(event)
      console.log("imgLoaded")
      this.preloadImages()
      this.imgLoading = false
    },
    downloadImage() {
      // const currentImage = this.images[this.currentIndex as number]
      // if (!currentImage) return
      // downloadImage(currentImage, "fiddl.art-" + extractImageId(currentImage) + ".webp")
      // Dialog.create({ component: DownloadImage })
    },
    share() {
      // const shareUrl = img(this.currentImageId, "lg")
      // console.log("share", shareUrl)
      // if (!shareUrl) return
      const url = this.$router.resolve({ name: "imageRequest", params: { requestShortId: longIdToShort(this.imageRequestId) }, query: { index: this.currentIndex } }).href
      const fullUrl = window.location.origin + url
      console.log("share", fullUrl)
      copyToClipboard(fullUrl)
      Dialog.create({
        title: "Image URL Copied",
        message: "The image URL has been copied to your clipboard",
        position: "top",
      })
    },
    openDialog(startingIndex = 0) {
      this.currentIndex = startingIndex
      this.isFullScreen = true
    },
    next() {
      // console.log("next", this.loading, this.imgLoading)
      // if (this.loading || this.imgLoading) return
      this.currentIndex = (this.currentIndex + 1) % this.imageIds.length
    },
    prev() {
      this.currentIndex = (this.currentIndex - 1 + this.imageIds.length) % this.imageIds.length
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
      console.log("click")
      const target = event.target as HTMLElement
      const rect = target.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const width = rect.width
      console.log(clickX)
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
      this.touchStartX = e.changedTouches[0].screenX
    },
    onTouchMove(e: TouchEvent) {
      if (!e.changedTouches[0]) return
      this.touchEndX = e.changedTouches[0].screenX
    },
    onTouchEnd() {
      // console.log("touchEnd")
      // const distance = this.touchEndX - this.touchStartX
      // if (Math.abs(distance) > this.threshold) {
      //   if (distance > 0) {
      //     this.prev()
      //   } else {
      //     this.next()
      //   }
      // }
      // this.touchStartX = 0
      // this.touchEndX = 0
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

<style lang="sass" scoped>
.hover-areas
  position: absolute
  top: 0
  left: 0
  width: 100%
  height: 100%
  display: flex

.left-area
  cursor: w-resize

.right-area
  cursor: e-resize

.indicators
  display: flex
  justify-content: center

.carousel
  position: relative
  width: 100%
  max-width: 600px
  margin: auto
  overflow: hidden

.carousel-container
  position: relative
  user-select: none

.overlay-image
  // width: 1000px
  // height:2000px
  object-fit: contain
  max-width: 90vw
  max-height: calc(85vh - 50px)

.prev-button, .next-button
  position: absolute
  top: 50%
  transform: translateY(-50%)
  background-color: rgba(0, 0, 0, 0.5)
  border: none
  color: white
  padding: 10px
  cursor: pointer
  font-size: 24px
  border-radius: 50%

.prev-button
  left: 10px

.next-button
  right: 10px

.indicators
  text-align: center
  position: absolute
  bottom: -20px
  width: 100%

.indicator
  display: inline-block
  height: 10px
  width: 10px
  margin: 0 5px 0px
  background-color: rgba(255, 255, 255, 0.5)
  border-radius: 50%
  cursor: pointer

.active
  background-color: rgba(255, 255, 255, 1)

.overlay
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-color: rgba(0, 0, 0, 0.9)
  display: flex
  justify-content: center
  align-items: center

.overlay-content
  position: relative
  // width: 95%
  max-width: 1900px
  max-height: 95%


@media (max-width: 600px)
  .prev-button, .next-button
    padding: 8px
    font-size: 20px
</style>
