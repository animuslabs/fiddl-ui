<template lang="pug">
div
  .image-cropper.bg-black( ref="stage")
    .mask-container
      //- Non-Blurred Foreground Image
      img(:src="imageSrc" @load="onImageLoad" @error="onImageError" :style="transformStyle" draggable="false")


</template>

<script lang="ts">
import html2canvas from "html2canvas"
import { QBtn } from "quasar"
import { compressedUrl } from "lib/imageCdn"

type ReadyState = "pending" | "ready" | "error"

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
      readyState: "pending" as ReadyState,
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
    this.setReadyState("pending")
    const query = (this.$route && this.$route.query) ? this.$route.query : {}
    if (typeof query.imageSrc === "string" && query.imageSrc) {
      this.setImageSrc(query.imageSrc)
    } else if (typeof query.imageId === "string" && query.imageId) {
      this.setImageSrc(compressedUrl(query.imageId, "lg"))
    } else {
      console.warn("AvatarCrop: missing image identifier in route query")
      this.setReadyState("error")
    }
  },
  beforeUnmount() {
    if (document.body) {
      delete document.body.dataset.avatarReady
    }
  },
  methods: {
    setImageSrc(src: string) {
      this.imageSrc = src
      this.setReadyState("pending")
    },
    onImageLoad(event: Event) {
      const img = event.target
      if (!(img instanceof HTMLImageElement)) return console.error("Invalid image element")
      const query = (this.$route && this.$route.query) ? this.$route.query : {}
      this.position.x = this.parseNumber((query as any).x, 0)
      this.position.y = this.parseNumber((query as any).y, 0)
      this.scale = this.parseNumber((query as any).scale, 1)
      this.setReadyState("ready")
    },

    onImageError() {
      console.error("AvatarCrop: failed to load image", this.imageSrc)
      this.setReadyState("error")
    },

    async acceptCrop() {
      // const result = await html2canvas(this.$refs.stage as HTMLElement, { foreignObjectRendering: false, useCORS: true, allowTaint: true })
      // const link = document.createElement("a")
      // link.href = result.toDataURL("image/png")
      // link.download = "cropped-image.png"
      // link.click()
    },
    parseNumber(value: unknown, fallback: number): number {
      if (typeof value === "string" && value !== "") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
      }
      return fallback
    },
    setReadyState(state: ReadyState) {
      this.readyState = state
      if (document.body) {
        document.body.dataset.avatarReady = state
      }
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
