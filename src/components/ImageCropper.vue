<template lang="pug">
.image-cropper-container
  .image-cropper.bg-black( ref="stage" @wheel="onWheel" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd")
    //- Blurred Background Image
    img(:src="imageSrc" :style="transformStyle" class="blurred-image" draggable="false" ref="image")
    //- Mask Container with Fixed Circular Mask
    .mask-container
      //- Non-Blurred Foreground Image
      img(:src="imageSrc" @load="onImageLoad" :style="transformStyle" draggable="false" ref="maskImage")
    //- SVG Overlay
    svg.overlay(viewBox="0 0 300 300")
      //- Darken the outside area
      circle(cx="150" cy="150" r="150" fill="rgba(0, 0, 0, 0)")
      //- Cut out the inner circle
      circle(cx="150" cy="150" r="148" fill="transparent" stroke="rgba(0, 0, 0, 0.1)" stroke-width="1")
      //- Draw the circle with 2px stroke
      circle(cx="150" cy="150" r="148" fill="none" stroke="grey" stroke-width="1")
  .controls.justify-center.q-mt-sm
    q-btn(flat round icon="arrow_upward" @click="panImage(0, 10)" color="grey-6")
    q-btn(flat round icon="arrow_downward" @click="panImage(0, -10)" color="grey-6")
    q-btn(round flat icon="arrow_back" @click="panImage(10, 0)" color="grey-6")
    q-btn(round flat icon="arrow_forward" @click="panImage(-10, 0)" color="grey-6")
    q-btn(flat round icon="zoom_out" @click="zoomImage(-0.1)" color="grey-6")
    q-btn(flat round icon="zoom_in" @click="zoomImage(0.1)" color="grey-6")
  div.q-mt-sm
    q-btn(color="grey-8" icon="close" label="Cancel" flat @click="$emit('cancel')")
    q-btn(color="primary" icon="check" label="Accept" flat @click="acceptCrop")

</template>

<script lang="ts">
import html2canvas from "html2canvas"
import { QBtn, SessionStorage } from "quasar"
import { defineComponent } from "vue"
import { hdUrl } from "lib/imageCdn"
import { img } from "lib/netlifyImg"

export interface CropData {
  scale: number
  position: { x: number; y: number }
}

export default {
  name: "ImageCropper",
  components: {
    QBtn,
  },
  props: {
    imageId: {
      type: String,
      required: true,
    },
  },
  emits: {
    cropAccepted: (data: CropData) => true,
    cancel: () => true,
  },
  data() {
    return {
      scale: 0.5,
      position: { x: 0, y: 0 },
      isDragging: false,
      startX: 0,
      startY: 0,
      imageSrc: undefined as string | undefined,
      loading: false,
    }
  },
  computed: {
    transformStyle() {
      return {
        transform: `translate(${this.position.x}px, ${this.position.y}px) scale(${this.scale})`,
      }
    },
  },
  mounted() {
    this.loadHdImage()
  },
  methods: {
    async loadHdImage(val?: string) {
      const id = val || this.imageId
      if (!this.$userAuth.loggedIn) return
      if (SessionStorage.getItem("noHdImage-" + id)) return
      this.loading = true
      try {
        const url = await hdUrl(id)
        void this.$nextTick(() => {
          this.imageSrc = url
        })
      } catch (error) {
        console.error(error)
        SessionStorage.setItem("noHdImage-" + id, true)
        // Fallback to compressed image
        this.imageSrc = img(id, "lg")
      } finally {
        this.loading = false
      }
    },
    onTouchStart(event: TouchEvent) {
      if (event.touches[0]) {
        this.isDragging = true
        this.startX = event.touches[0].clientX - this.position.x
        this.startY = event.touches[0].clientY - this.position.y
      }
    },
    onTouchMove(event: TouchEvent) {
      if (this.isDragging && event.touches[0]) {
        this.position.x = event.touches[0].clientX - this.startX
        this.position.y = event.touches[0].clientY - this.startY
      }
    },
    onTouchEnd() {
      this.isDragging = false
    },
    onImageLoad(event: Event) {
      const img = event.target
      if (!(img instanceof HTMLImageElement)) return console.error("Invalid image element")
      const imgWidth = img.naturalWidth
      const imgHeight = img.naturalHeight

      // Calculate initial position to center the image
      this.position.x = (300 - imgWidth) / 2
      this.position.y = (300 - imgHeight) / 2
    },
    onWheel(event: WheelEvent) {
      event.preventDefault()
      const zoomFactor = 0.001
      const delta = event.deltaY * zoomFactor
      this.scale -= delta
      if (this.scale < 0.1) this.scale = 0.1
      if (this.scale > 3) this.scale = 3
    },
    onMouseDown(event: MouseEvent) {
      this.isDragging = true
      this.startX = event.clientX - this.position.x
      this.startY = event.clientY - this.position.y
    },
    onMouseMove(event: MouseEvent) {
      if (this.isDragging) {
        this.position.x = event.clientX - this.startX
        this.position.y = event.clientY - this.startY
      }
    },
    onMouseUp() {
      this.isDragging = false
    },
    panImage(dx: number, dy: number) {
      this.position.x += dx
      this.position.y += dy
    },
    zoomImage(deltaScale: number) {
      this.scale += deltaScale
      if (this.scale < 0.1) this.scale = 0.1
      if (this.scale > 3) this.scale = 3
    },
    acceptCrop() {
      this.$emit("cropAccepted", {
        scale: this.scale,
        position: this.position,
      })
    },
  },
}
</script>

<style scoped>
.image-cropper-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-cropper {
  position: relative;
  width: 300px; /* Desired crop area width */
  height: 300px; /* Desired crop area height */
  overflow: hidden;
  user-select: none;
  /* margin-bottom: 10px; */
}

.image-cropper img {
  position: absolute;
  top: 0;
  left: 0;
  -webkit-user-drag: none;
  cursor: grab;
}

.blurred-image {
  /* filter: blur(4px), brightness(0.5); */
  /* // blur and darken */
  filter: blur(4px) brightness(0.3);
}

.mask-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* Apply fixed circular mask to the container */
  clip-path: circle(50% at 50% 50%);
  -webkit-clip-path: circle(50% at 50% 50%); /* For Safari */
  pointer-events: none; /* Allow interactions to pass through */
}

.mask-container img {
  position: absolute;
  top: 0;
  left: 0;
  /* Apply the same transform to move the image */
  transform: translate(0, 0); /* Ensure the transform is reset */
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 300px;
  height: 300px;
  pointer-events: none;
}

.controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 310px;
}

.pan-horizontal {
  display: flex;
  justify-content: center;
}

.accept-button {
  margin-top: 10px;
}
</style>
