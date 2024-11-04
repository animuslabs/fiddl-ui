<template lang="pug">
div
  .image-cropper.bg-black( ref="stage")
    .mask-container
      //- Non-Blurred Foreground Image
      img(:src="imageSrc" @load="onImageLoad" :style="transformStyle" draggable="false")


</template>

<script lang="ts">
import html2canvas from "html2canvas"
import { QBtn } from "quasar"

export interface CropData {
  scale: number
  position: { x: number; y: number }
}

export default {
  name: "ImageCropper",
  components: {
    QBtn,
  },
  emits: {
    cropAccepted: (data: CropData) => true,
    cancel: () => true,
  },
  data() {
    return {
      scale: 1,
      position: { x: 0, y: 0 },
      isDragging: false,
      imageSrc: "",
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
    //@ts-ignore
    this.imageSrc = this.$route.query.imageSrc as string
  },
  methods: {
    onImageLoad(event: Event) {
      const img = event.target
      if (!(img instanceof HTMLImageElement)) return console.error("Invalid image element")
      //@ts-ignore
      this.position.x = this.$route.query.x ? parseInt(this.$route.query.x as string) : 0
      //@ts-ignore
      this.position.y = this.$route.query.y ? parseInt(this.$route.query.y as string) : 0
      //@ts-ignore
      this.scale = this.$route.query.scale ? parseFloat(this.$route.query.scale as string) : 1
    },

    async acceptCrop() {
      // const result = await html2canvas(this.$refs.stage as HTMLElement, { foreignObjectRendering: false, useCORS: true, allowTaint: true })
      // const link = document.createElement("a")
      // link.href = result.toDataURL("image/png")
      // link.download = "cropped-image.png"
      // link.click()
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
