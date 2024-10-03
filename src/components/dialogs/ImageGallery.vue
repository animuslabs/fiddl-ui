<template lang="pug">
.carousel.carousel-container(@touchstart="onTouchStart" @touchmove="onTouchMove")
  img.carousel-image(v-if="!hidden" :src="images[currentIndex]" alt="Carousel Image" @click="onImageClick")

  button.prev-button(@click="prev") ‹
  button.next-button(@click="next") ›

  .indicators(v-if="images.length > 1")
    span.indicator(v-for="(image, index) in images" :key="index" :class="{ active: index === currentIndex }" @click="goTo(index)")

  .overlay(v-if="isFullScreen" tabindex="0" @click.self="closeFullScreen").z-top.cursor-pointer
    .centered.bg-green
    .overlay-content.relative-position
      //- q-spinner.absolute-center(size="100px")
      .centered.q-mb-md.relative-position(:style="{visibility: downloadMode ? 'hidden' : 'visible'}")
        div
          q-btn(icon="share"  flat @click="share()" round color="grey-5")
        div
          q-btn(icon="download"  flat @click="downloadMode = true" round :class="downloadClass")
            q-tooltip
              p(v-if="userOwnsImage") You own the 4k download
              p(v-else) Download Image
        //- q-btn(icon="edit" flat @click="closeFullScreen")
        //- q-btn(icon="favorite" flat @click="closeFullScreen")
        //- q-btn(icon="add" flat @click="closeFullScreen")
        div
          q-btn(icon="close" flat @click="closeFullScreen" round color="grey-5")
      //- q-img.overlay-image(:src="images[currentIndex]" alt="Full Screen Image"  no-transition @click="onImageClick" ref="overlayImage")
      q-linear-progress.absolute-bottom( indeterminate v-if="imgLoading || loading" )
      .absolute.full-width.full-height(style="background-color: rgba(0,0,0,.5);" v-if="imgLoading")
      .absolute.full-width(style="background-color: rgba(0,0,0,.8);  height:100vh;" v-if="downloadMode")
        .centered
          h4 Download Image
        .centered(v-if="!userOwnsImage")
          ul.q-ma-md
            li You do not own this image. It can be purchased with Fiddl Points.
            li When you purchase the image, it will always display in full resolution without a watermark on fiddl.art.
            li You will have access to the original full quality image as well as a 4k upscaled version suitable for printing.
          .centered.q-pt-md
            q-btn(color="accent" label="Purchase Image" @click="purchaseImage()" :disable="!$userAuth.loggedIn")
              .badge
                p 10
          .centered(v-if="!$userAuth.loggedIn").q-mt-lg
            q-btn(color="primary" @click="goToLogin()" label="Login to purchase images")
        div(v-else style="height:30vh")
          .centered
            p.q-ma-md You own this image.
          .centered
            div
              .row
                p.q-ma-md Downloads
              .col-auto
                q-btn(label="original" icon="image" @click="downloadOriginal()")
              .col-auto
                q-btn(label="4k Upscale" icon="4k" :loading="upscaling" @click="downloadUpscaled()")
              small Upscaling can take 30+ seconds the first time
        .centered.q-mt-md
          q-btn(label="< back" color="grey" flat @click="downloadMode = false")
      img.overlay-image(:src="images[currentIndex]" @click="onImageClick" ref="overlayImage" @load="imgLoaded")
      .indicators(v-if="images.length > 1 && !downloadMode")
        span.indicator( v-for="(image, index) in images" :key="index" :class="{ active: index === currentIndex }" @click="goTo(index)")
</template>

<script lang="ts">
import { log } from "console"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import { catchErr, copyToClipboard, downloadFile, downloadImage, extractImageId, generateShortHash } from "lib/util"
import { Dialog, Loading } from "quasar"
import { defineComponent } from "vue"
import DownloadImage from "./DownloadImage.vue"

export default defineComponent({
  props: {
    images: {
      type: Array as () => string[],
      required: true,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
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
    }
  },
  computed: {
    downloadClass() {
      return this.userOwnsImage ? "text-positive" : "text-white"
    },
    currentImageId() {
      const currentImage = this.images[this.currentIndex as number]
      if (!currentImage) return
      return extractImageId(currentImage)
    },
  },
  watch: {
    currentImageId(val: string) {
      if (!val) return
      void this.$nextTick(() => {
        this.imgLoading = true
      })
      void this.loadHdImage(val)
    },
    isFullScreen(newVal: boolean) {
      if (newVal) {
        window.addEventListener("keydown", this.handleKeyDown)
      } else {
        window.removeEventListener("keydown", this.handleKeyDown)
      }
    },
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown)
  },
  methods: {
    goToLogin() {
      this.closeFullScreen()
      void this.$router.push({ name: "login" })
    },
    async downloadOriginal() {
      if (!this.userOwnsImage) return
      if (!this.currentImageId) return
      const imageData = (await this.$api.creations.originalImage.query(this.currentImageId).catch(catchErr)) || undefined
      const imageDataUrl = `data:image/png;base64,${imageData}`
      downloadFile(imageDataUrl, this.currentImageId + ".png")
    },
    async downloadUpscaled() {
      if (!this.userOwnsImage) return
      if (!this.currentImageId) return
      this.upscaling = true
      Loading.show({
        message: "Upscaling Image",
      })

      const imageData = (await this.$api.creations.upscaledImage.query(this.currentImageId).catch(catchErr)) || undefined
      if (!imageData) return console.error("No image data")
      const imageDataUrl = `data:image/png;base64,${imageData}`
      downloadFile(imageDataUrl, this.currentImageId + ".png")
      Loading.hide()
      this.upscaling = false
    },
    async loadHdImage(val: string) {
      if (!this.$userAuth.loggedIn) return
      this.userOwnsImage = false
      let imageData = getImageFromCache(val)
      if (!imageData) {
        this.loading = true
        imageData = (await this.$api.creations.hdImage.query(val).catch(() => {})) || undefined
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
    async purchaseImage() {
      if (!this.currentImageId) return
      const result = await this.$api.creations.purchaseImage.mutate(this.currentImageId).catch(catchErr)
      if (!result) return
      this.userOwnsImage = true
      void this.loadHdImage(this.currentImageId)
    },
    preloadImages() {
      this.images.forEach((src, index) => {
        if (index !== this.currentIndex) {
          const img = new Image()
          img.src = src
        }
      })
    },
    imgLoaded(event: Event) {
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
      const currentImage = this.images[this.currentIndex as number]
      console.log("share", currentImage)
      if (!currentImage) return
      copyToClipboard(currentImage)
      // copyToClipboard(process.env.API_URL + currentImage)
      if (this.isFullScreen) this.closeFullScreen()
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
      console.log("next")
      if (this.loading || this.imgLoading) return
      this.currentIndex = (this.currentIndex + 1) % this.images.length
    },
    prev() {
      this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length
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
      console.log(event.target)
      if (this.isFullScreen) {
        console.log(clickX)
        if (clickX < width / 2) {
          this.prev()
        } else {
          this.next()
        }
      } else {
        this.openFullScreen()
      }
    },
    handleKeyDown(e: KeyboardEvent) {
      if (!this.isFullScreen) return

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
