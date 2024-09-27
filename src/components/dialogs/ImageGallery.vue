<template lang="pug">
.carousel.carousel-container(@touchstart="onTouchStart" @touchmove="onTouchMove")
  img.carousel-image(v-if="!hidden" :src="images[currentIndex]" alt="Carousel Image" @click="onImageClick")

  button.prev-button(@click="prev") ‹
  button.next-button(@click="next") ›

  .indicators(v-if="images.length > 1")
    span.indicator(v-for="(image, index) in images" :key="index" :class="{ active: index === currentIndex }" @click="goTo(index)")

  .overlay(v-if="isFullScreen" tabindex="0" @click.self="closeFullScreen" @click="onOverlayClick").z-top.cursor-pointer
    .overlay-content
      .centered.q-mb-md
        q-btn(icon="share"  flat @click="share()")
        q-btn(icon="download"  flat @click="downloadImage()")
        //- q-btn(icon="edit" flat @click="closeFullScreen")
        //- q-btn(icon="favorite" flat @click="closeFullScreen")
        //- q-btn(icon="add" flat @click="closeFullScreen")
        q-btn(icon="close" flat @click="closeFullScreen")
      //- q-img.overlay-image(:src="images[currentIndex]" alt="Full Screen Image"  no-transition @click="onImageClick" ref="overlayImage")
      img.overlay-image(:src="images[currentIndex]" @click="onImageClick" ref="overlayImage")
      .indicators(v-if="images.length > 1")
        span.indicator( v-for="(image, index) in images" :key="index" :class="{ active: index === currentIndex }" @click="goTo(index)")
</template>

<script lang="ts">
import { log } from "console"
import { copyToClipboard, downloadFile, downloadImage, extractImageId, generateShortHash } from "lib/util"
import { Dialog } from "quasar"
import { defineComponent } from "vue"

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
      currentIndex: 0,
      isFullScreen: false,
      touchStartX: 0,
      touchEndX: 0,
      threshold: 50, // Minimum swipe distance
    }
  },
  watch: {
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
    downloadImage() {
      const currentImage = this.images[this.currentIndex as number]
      if (!currentImage) return
      downloadImage(currentImage, "fiddl.art-" + extractImageId(currentImage) + ".webp")
    },
    share() {
      const currentImage = this.images[this.currentIndex as number]
      if (!currentImage) return
      copyToClipboard(currentImage)
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
    },
    onOverlayClick(event: MouseEvent) {
      const imageElement = this.$refs.overlayImage.$el as HTMLElement
      console.log("imgElement", imageElement)
      if (imageElement) {
        const rect = imageElement.getBoundingClientRect()
        const clickX = event.clientX
        const clickY = event.clientY

        // Check if the click is outside the image's bounding box
        if (clickX < rect.left || clickX > rect.right || clickY < rect.top || clickY > rect.bottom) {
          this.closeFullScreen()
        }
      }
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
  width: auto
  max-width: 1900px
  display: block
  max-height: 80vh

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
