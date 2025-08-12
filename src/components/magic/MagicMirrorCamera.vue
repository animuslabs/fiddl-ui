<template lang="pug">
div
  //- Live camera section
  div(v-if="mode === 'camera'")
    .centered
      h5.q-mb-xs Camera
    .q-pa-sm.flex.column.items-center
      div(style="position:relative; width:100%; max-width:520px;")
        //- Tips and countdown overlay
        div#countdownOverlay.bg-blur-lite(
          v-if="showTipsOverlay"
          :class="{ active: showTipsOverlay }"
        )
          .countdown-content
            .countdown-tips
              .q-ma-md
                h4.q-mb-md The Magic Mirror will capture your essence.
                h4 #[strong Be Natural!]
            .countdown-number(v-if="countdownActive") {{ countdownValue }}
            q-btn.z-top(
              color="primary"
              :label="isCapturing ? 'Capturing…' : 'Start Capture'"
              :disable="isCapturing || !cameraReady"
              @click="startAutoCapture"
              icon="photo_camera"
              stack
              outline
              size="lg"
              padding="20px"
              no-caps
            )
            .centered.q-mt-md
              p For best results, move your head to provide multiple angles.
        //- Flash overlay
        div#flashOverlay(
          v-show="flashActive"
          :class="{ active: flashActive }"
        )
        video#mmVideo(
          ref="videoRef"
          autoplay
          muted
          :style="videoStyle"
        )
        //- Overlay counter / hint
        div.absolute-top-left.q-pa-sm(v-if="isCapturing")
          q-chip(color="primary" text-color="white" icon="photo_camera")
            | {{ captured.length }} / {{ targetFrames }}
      .row.q-gutter-sm.justify-center.q-mt-md
        q-btn(
          outline
          color="primary"
          label="Select From Gallery Instead"
          @click="switchToGallery"
          icon="photo_library"
          no-caps
        )
    .centered.q-mt-md
      p.text-secondary(v-if="!cameraReady && permissionDenied") Camera permission is blocked. Enable it in your browser settings, then reload. You can also pick a selfie from your gallery.
      p.text-secondary(v-else-if="!cameraReady") Allow camera permission and ensure the front camera is available

    //- Audio element for shutter sound
    audio#shutterAudio(ref="shutterAudioRef" src="/audio/camera-shutter.mp3" preload="auto")

  //- Gallery picker section
  div(v-else)
    .centered
      .q-pa-sm.flex.column.items-center
        q-uploader(
          ref="uploaderRef"
          accept="image/*"
          label="Select selfie"
          :max-files="10"
          :auto-upload="false"
          @added="onFilesAdded"
          style="max-width:520px; width:100%;"
        )
        .row.q-gutter-sm.justify-center.q-mt-md
          q-btn(outline color="primary" label="Back to Camera" @click="switchToCamera" icon="photo_camera" no-caps)

</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from "vue"
import { Dialog, useQuasar } from "quasar"

/**
 * NOTE: To enable the camera shutter sound, place a short sound file at:
 *   public/camera-shutter.mp3
 * You can use any royalty-free camera shutter sound.
 */

const emit = defineEmits<{
  (e: "captured", blobs: Blob[]): void
  (e: "error", reason: string): void
}>()

// Config
const targetFrames = 8
const totalDurationMs = 3000
const countdownSeconds = 1
const mimeType = "image/jpeg"
const quality = 0.9

// State
const mode = ref<"camera" | "gallery">("camera")
const videoRef = ref<HTMLVideoElement | null>(null)
const streamRef = ref<MediaStream | null>(null)
const isCapturing = ref(false)
const cameraReady = ref(false)
const permissionDenied = ref(false)
const captured = ref<Blob[]>([])
const uploaderRef = ref()

// Flash and sound
const flashActive = ref(false)
const shutterAudioRef = ref<HTMLAudioElement | null>(null)

// Countdown overlay
const countdownActive = ref(false)
const countdownValue = ref(countdownSeconds)

// Show tips overlay if in camera mode, not capturing, and not in countdown
const showTipsOverlay = computed(() => mode.value === "camera" && !isCapturing.value && !countdownActive.value)

function triggerFlashAndSound() {
  // Flash
  flashActive.value = true
  setTimeout(() => {
    flashActive.value = false
  }, 120)
  // Sound
  if (shutterAudioRef.value) {
    // Restart sound if already playing
    shutterAudioRef.value.currentTime = 0
    shutterAudioRef.value.play().catch(() => {})
  }
}

const $q = useQuasar()

const videoStyle = computed(
  (): Record<string, string> => ({
    width: "100%",
    maxWidth: "520px",
    borderRadius: "8px",
    objectFit: "cover",
    transform: "scaleX(-1)",
  }),
)

onMounted(() => {
  // ensure playsinline for iOS
  if (videoRef.value) videoRef.value.setAttribute("playsinline", "true")
  void initCamera()
})

onBeforeUnmount(() => {
  stopStream()
})

function isPermissionDeniedError(err: any): boolean {
  const name = err?.name || ""
  const msg = String(err?.message || "").toLowerCase()
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" || msg.includes("permission denied") || msg.includes("denied by system")
}
async function initCamera() {
  try {
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 720 },
        height: { ideal: 720 },
      },
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    streamRef.value = stream
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
      cameraReady.value = true
    }
  } catch (err: any) {
    console.error(err)
    cameraReady.value = false
    const denied = isPermissionDeniedError(err)
    permissionDenied.value = denied
    emit("error", denied ? "camera_permission_denied" : "camera_unavailable")
    Dialog.create({
      title: denied ? "Camera permission needed" : "Camera unavailable",
      message: denied ? "Camera access is blocked. Enable camera permission in your browser settings, then reload. You can also pick a selfie from your gallery." : "We couldn't access your camera. You can pick a selfie from your gallery instead.",
      ok: true,
    })
    mode.value = "gallery"
  }
}

function stopStream() {
  if (streamRef.value) {
    for (const track of streamRef.value.getTracks()) track.stop()
    streamRef.value = null
  }
}

function switchToGallery() {
  stopStream()
  mode.value = "gallery"
}
function switchToCamera() {
  mode.value = "camera"
  void initCamera()
}

async function startAutoCapture() {
  if (!videoRef.value) return
  // Start countdown (tips overlay is already visible)
  countdownActive.value = true
  countdownValue.value = countdownSeconds
  isCapturing.value = false
  captured.value = []
  // Countdown logic
  for (let i = countdownSeconds; i > 0; i--) {
    countdownValue.value = i
    await wait(1000)
  }
  countdownActive.value = false
  isCapturing.value = true
  captured.value = []
  const step = Math.max(100, Math.floor((totalDurationMs / targetFrames) * 2))
  const start = Date.now()

  try {
    while (captured.value.length < targetFrames && Date.now() - start < totalDurationMs * 2 + 1600) {
      const blob = await captureFrame(videoRef.value)
      captured.value.push(blob)
      // Flash and sound after each capture
      triggerFlashAndSound()
      await wait(step)
    }
  } catch (err) {
    console.error(err)
    emit("error", "capture_failed")
  } finally {
    isCapturing.value = false
  }

  if (captured.value.length > 0) {
    // Return captured frames
    emit("captured", captured.value.slice())
  } else {
    emit("error", "no_frames")
    $q.notify({ message: "No frames captured", color: "negative" })
  }
}

async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const w = Math.max(512, Math.min(1024, video.videoWidth || 720))
  const h = Math.max(512, Math.min(1024, video.videoHeight || 720))
  const s = Math.min(w, h) // square crop center
  const cx = Math.floor((w - s) / 2)
  const cy = Math.floor((h - s) / 2)

  const canvas = document.createElement("canvas")
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no_ctx")
  // Draw without mirror to save correct orientation
  ctx.drawImage(video, cx, cy, s, s, 0, 0, s, s)
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), mimeType, quality))
  return blob
}

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function onFilesAdded(files: readonly any[]) {
  // q-uploader passes a file wrapper; normalize to File[]
  const normalized = Array.from(files || [])
    .map((f: any) => f.__file || f.file || f)
    .filter((f: any) => f instanceof File) as File[]

  if (!normalized.length) {
    emit("error", "gallery_no_file")
    return
  }

  // For simplicity in v1, duplicate with minor transforms to reach targetFrames
  const file = normalized[0]!
  readAsImageAndSynthesize(file)
    .then((blobs) => emit("captured", blobs))
    .catch((e) => {
      console.error(e)
      emit("error", "gallery_failed")
    })
}

async function readAsImageAndSynthesize(file: File): Promise<Blob[]> {
  const imgUrl = URL.createObjectURL(file)
  const img = new Image()
  img.crossOrigin = "anonymous"
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = (e) => rej(e)
    img.src = imgUrl
  })

  const s = 720
  const canvas = document.createElement("canvas")
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no_ctx")

  const blobs: Blob[] = []
  for (let i = 0; i < targetFrames; i++) {
    // Slight random brightness/contrast to simulate variety
    ctx.clearRect(0, 0, s, s)
    ctx.filter = `brightness(${100 + (Math.random() * 10 - 5)}%) contrast(${100 + (Math.random() * 10 - 5)}%)`
    ctx.drawImage(img, 0, 0, s, s)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), mimeType, quality))
    blobs.push(blob)
  }
  URL.revokeObjectURL(imgUrl)
  return blobs
}
</script>

<style scoped>
.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
#mmVideo {
  background: #111;
}

/* Countdown overlay styles */
#countdownOverlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 20;
  font-size: 1.2rem;
  /* pointer-events: none; -- removed to allow interaction */
}
#countdownOverlay .countdown-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}
#countdownOverlay .countdown-number {
  font-size: 4rem;
  font-weight: bold;
  margin-bottom: 1.2rem;
}
#countdownOverlay .countdown-tips {
  font-size: 1.1rem;
  margin-bottom: 0.7rem;
  text-align: center;
}
#countdownOverlay ul {
  margin: 0.5rem 0 0 0;
  padding: 0 1.5rem;
  text-align: left;
}
#countdownOverlay li {
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

/* Flash overlay styles */
#flashOverlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: white;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
  transition: opacity 0.12s;
}
#flashOverlay.active {
  opacity: 1;
}
</style>
