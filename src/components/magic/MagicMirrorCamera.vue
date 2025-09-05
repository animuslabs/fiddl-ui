<template lang="pug">
div
  // Onboarding: first-time camera access heads up
  q-dialog(v-model="cameraIntroDialog" persistent :maximized="!isDesktop")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Camera Access Needed
          q-btn(flat dense round icon="close" v-close-popup @click="dismissIntroToUpload")
      q-separator
      q-card-section
        .centered.q-ma-md
          q-img(src="https://fiddl-art.sfo3.cdn.digitaloceanspaces.com/fiddl-assets/MagicMirror-sm.webp" style="max-width:600px;")
        p We will request camera access to take your selfie.
        p You can also upload a selfie from your gallery instead.
      q-card-actions(align="right")
        q-btn(flat label="Upload Instead" color="grey" no-caps @click="dismissIntroToUpload")
        q-btn(color="primary" size="lg" icon="camera" label="Continue" no-caps @click="confirmIntroAndStart")

  div
    .centered
    .q-pa-sm.flex.column.items-center
      div(:class="['video-container', { fullscreen: !isDesktop }]")
        div#countdownOverlay(
          v-if="showTipsOverlay"
          :class="{ active: showTipsOverlay }"
        )
          .countdown-content
            .countdown-tips.lt-sm
              .q-ma-md
                h2.q-mb-md.text-primary Magic Mirror
            .countdown-number(v-if="countdownActive") {{ countdownValue }}
            q-btn.z-top.q-pt-sm.bg-blur(
              color="primary"

              :disable="isCapturing || !cameraReady"
              @click="startAutoCapture"
              icon="photo_camera"
              stack
              outline
              size="lg"
              no-caps
            )
             | Start Capture

            .centered.q-ma-md
              small For best results, move your head to provide multiple angles.

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
      .row.q-gutter-sm.justify-center.q-mt-md(:class="{ 'floating-controls': !isDesktop }" :style="!isDesktop ? floatingControlsStyle : undefined")
        q-btn(
          v-if="isDesktop && videoDevices.length > 1"
          outline
          color="primary"
          label="Switch Camera"
          @click="switchToNextCamera"
          icon="switch_camera"
          no-caps
        )
        q-btn(
          outline
          color="primary"
          label="Select From Gallery Instead"
          @click="switchToGallery"
          icon="photo_library"
          no-caps
        )
        q-btn.z-top(
          v-if="!isDesktop && videoDevices.length > 1"
          round
          dense
          outline
          color="grey"
          icon="switch_camera"
          @click="switchToNextCamera"
          :disable="false"
          aria-label="Switch camera"
          style="position:absolute; bottom:0px; left:20px; z-index:21; pointer-events:auto; touch-action:manipulation;"
        )
    .centered.q-mt-md
      p.text-secondary(v-if="!cameraReady && permissionDenied") Camera permission is blocked. Enable it in your browser settings, then reload. You can also pick a selfie from your gallery.
      p.text-secondary(v-else-if="!cameraReady") Allow camera permission and ensure the front camera is available

    //- Audio element for shutter sound
    audio#shutterAudio(ref="shutterAudioRef" src="/audio/camera-shutter.mp3" preload="auto")
    //- Hidden file input for instant gallery selection
    input#filePicker(type="file" accept="image/*" multiple ref="fileInputRef" @change="onFileInputChange" style="display:none")

</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from "vue"
import { useQuasar, LocalStorage } from "quasar"
import { catchErr } from "lib/util"
import { useUserAuth } from "src/stores/userAuth"

const emit = defineEmits<{
  (e: "captured", blobs: Blob[]): void
  (e: "error", reason: string): void
  (e: "auth-required"): void
  (e: "insufficient-points"): void
}>()

// Config
const targetFrames = 4
const totalDurationMs = 2000
const countdownSeconds = 0.5
const mimeType = "image/jpeg"
const quality = 0.97

/** State */
const videoRef = ref<HTMLVideoElement | null>(null)
const streamRef = ref<MediaStream | null>(null)
const isCapturing = ref(false)
const cameraReady = ref(false)
const permissionDenied = ref(false)
const captured = ref<Blob[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

// Camera device management
const videoDevices = ref<MediaDeviceInfo[]>([])
const currentDeviceId = ref<string | null>(null)
const LAST_VIDEO_DEVICE_KEY = "mmVideoDeviceId"

// Flash and sound
const flashActive = ref(false)
const shutterAudioRef = ref<HTMLAudioElement | null>(null)

// Countdown overlay
const countdownActive = ref(false)
const countdownValue = ref(countdownSeconds)

// Show tips overlay when not capturing and not in countdown
const showTipsOverlay = computed(() => !isCapturing.value && !countdownActive.value)

function triggerFlashAndSound() {
  // Flash
  flashActive.value = true
  setTimeout(() => {
    flashActive.value = false
  }, 120)
  // Sound
  if (shutterAudioRef.value) {
    // Restart sound if already playing
    shutterAudioRef.value.volume = 0.1
    shutterAudioRef.value.currentTime = 0
    shutterAudioRef.value.play().catch(() => {})
  }
}

const quasar = useQuasar()

const userAuth = useUserAuth()
const availablePoints = computed(() => userAuth.userData?.availablePoints || 0)

// Props
const props = defineProps<{ requiredPoints?: number }>()
const requiredPoints = computed(() => props.requiredPoints ?? 0)

const isDesktop = computed(() => quasar.screen.gt.sm)
const floatingControlsStyle = computed(
  (): Record<string, string> => ({
    bottom: `calc(env(safe-area-inset-bottom, 0px) + ${quasar.screen.gt.sm ? "16px" : "88px"})`,
  }),
)

const videoStyle = computed((): Record<string, string> => {
  if (quasar.screen.gt.sm) {
    return {
      width: "100%",
      maxWidth: "520px",
      borderRadius: "8px",
      objectFit: "cover",
      transform: "scaleX(-1)",
    }
  } else {
    return {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100vh",
      maxHeight: "900px",
      borderRadius: "0",
      objectFit: "cover",
      transform: "scaleX(-1)",
    }
  }
})

// First-time camera permission dialog
const CAMERA_INTRO_KEY = "mmCameraIntroShown"
const cameraIntroDialog = ref(false)
function confirmIntroAndStart() {
  try {
    LocalStorage.set(CAMERA_INTRO_KEY, true)
  } catch {}
  cameraIntroDialog.value = false
  void initCamera()
}
function dismissIntroToUpload() {
  try {
    LocalStorage.set(CAMERA_INTRO_KEY, true)
  } catch {}
  cameraIntroDialog.value = false
  openGalleryPicker()
}

onMounted(() => {
  if (videoRef.value) videoRef.value.setAttribute("playsinline", "true")
  const shown = LocalStorage.getItem(CAMERA_INTRO_KEY)
  if (shown) {
    void initCamera()
  } else {
    cameraIntroDialog.value = true
  }
  if (navigator.mediaDevices && "addEventListener" in navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener("devicechange", fetchVideoDevices)
  }
})

onBeforeUnmount(() => {
  stopStream()
  if (navigator.mediaDevices && "removeEventListener" in navigator.mediaDevices) {
    navigator.mediaDevices.removeEventListener("devicechange", fetchVideoDevices)
  }
})

function isPermissionDeniedError(err: any): boolean {
  const name = err?.name || ""
  const msg = String(err?.message || "").toLowerCase()
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" || msg.includes("permission denied") || msg.includes("denied by system")
}
async function initCamera(deviceId?: string) {
  try {
    const videoConstraint: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1024 }, height: { ideal: 1024 } } : { facingMode: { ideal: "user" }, width: { ideal: 1024 }, height: { ideal: 1024 } }

    const constraints: MediaStreamConstraints = { audio: false, video: videoConstraint }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    streamRef.value = stream

    // Persist the actual active deviceId when available
    const settings = stream.getVideoTracks()[0]?.getSettings?.()
    if (settings?.deviceId) {
      currentDeviceId.value = settings.deviceId
      LocalStorage.set(LAST_VIDEO_DEVICE_KEY, settings.deviceId)
    }

    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
      cameraReady.value = true
    }

    // Refresh devices list after we have permission
    await fetchVideoDevices()
  } catch (err: any) {
    cameraReady.value = false
    const denied = isPermissionDeniedError(err)
    permissionDenied.value = denied
    emit("error", denied ? "camera_permission_denied" : "camera_unavailable")
    catchErr(new Error(denied ? "Camera access is blocked. Enable camera permission in your browser settings, then reload. You can also pick a selfie from your gallery." : "We couldn't access your camera. You can pick a selfie from your gallery instead."))
    // Offer gallery picker immediately if camera unavailable
    openGalleryPicker()
  }
}

function stopStream() {
  if (streamRef.value) {
    for (const track of streamRef.value.getTracks()) track.stop()
    streamRef.value = null
  }
}

function switchToGallery() {
  // Do not stop stream yet; allow user to cancel picker and continue camera
  openGalleryPicker()
}

async function startAutoCapture() {
  // Prevent capture when not authenticated
  if (!userAuth.loggedIn) {
    emit("auth-required")
    return
  }
  // Prevent capture when not enough points
  if (availablePoints.value < requiredPoints.value) {
    emit("insufficient-points")
    return
  }
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
  } catch (err: any) {
    catchErr(err)
    emit("error", "capture_failed")
  } finally {
    isCapturing.value = false
  }

  if (captured.value.length > 0) {
    // Return captured frames
    emit("captured", captured.value.slice())
  } else {
    emit("error", "no_frames")
    quasar.notify({ message: "No frames captured", color: "negative" })
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

// Enumerate available video input devices
async function fetchVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videos = devices.filter((d) => d.kind === "videoinput")
    videoDevices.value = videos

    // If we don't have a current deviceId, try to detect from active track
    if (!currentDeviceId.value && streamRef.value) {
      const activeId = streamRef.value.getVideoTracks()[0]?.getSettings?.().deviceId
      if (activeId) currentDeviceId.value = activeId
    }

    // If saved device no longer exists, drop it
    if (currentDeviceId.value && !videos.find((d) => d.deviceId === currentDeviceId.value)) {
      currentDeviceId.value = null
      LocalStorage.remove(LAST_VIDEO_DEVICE_KEY)
    }
  } catch (e) {
    catchErr(e)
  }
}
async function switchToNextCamera() {
  console.log("switch camera")
  if (!videoDevices.value.length) {
    await fetchVideoDevices()
  }
  const vids = videoDevices.value
  if (!vids.length) return

  const idx = Math.max(0, currentDeviceId.value ? vids.findIndex((d) => d.deviceId === currentDeviceId.value) : -1)
  const nextIndex = (idx + 1) % vids.length
  const nextDevice = vids[nextIndex]
  if (!nextDevice) return

  currentDeviceId.value = nextDevice.deviceId
  LocalStorage.set(LAST_VIDEO_DEVICE_KEY, nextDevice.deviceId)

  stopStream()
  await initCamera(currentDeviceId.value)
}

function openGalleryPicker() {
  fileInputRef.value?.click()
}

function onFileInputChange(e: Event) {
  if (!userAuth.loggedIn) {
    emit("auth-required")
    if (fileInputRef.value) fileInputRef.value.value = ""
    return
  }
  if (availablePoints.value < requiredPoints.value) {
    emit("insufficient-points")
    if (fileInputRef.value) fileInputRef.value.value = ""
    return
  }
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return

  const MAX = 20
  const selected = files.slice(0, MAX)
  if (files.length > MAX) {
    quasar.notify({ color: "primary", message: `Using first ${MAX} images (max).` })
  }

  Promise.allSettled(selected.map((f) => readAsImage(f)))
    .then((results) => {
      const blobs = results.filter((r): r is PromiseFulfilledResult<Blob> => r.status === "fulfilled").map((r) => r.value)
      const failed = results.length - blobs.length
      if (failed > 0) {
        quasar.notify({ color: "warning", message: `Skipped ${failed} unsupported image${failed > 1 ? "s" : ""}.` })
      }
      if (blobs.length > 0) {
        emit("captured", blobs)
      } else {
        emit("error", "gallery_failed")
      }
    })
    .catch((err) => {
      catchErr(err)
      emit("error", "gallery_failed")
    })
    .finally(() => {
      // Reset input so selecting the same file again will re-trigger change
      if (fileInputRef.value) fileInputRef.value.value = ""
    })
}

async function readAsImage(file: File): Promise<Blob> {
  // Prefer ImageBitmap for better format support and EXIF orientation
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image", colorSpaceConversion: "default", premultiplyAlpha: "premultiply" } as any)
  } catch {
    // Fallback to HTMLImageElement
    const imgUrl = URL.createObjectURL(file)
    const img = new Image()
    img.crossOrigin = "anonymous"
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = (e) => rej(e)
      img.src = imgUrl
    })
    const iw = (img as any).naturalWidth || img.width
    const ih = (img as any).naturalHeight || img.height
    const side = Math.max(1, Math.min(iw, ih))
    const sx = Math.floor((iw - side) / 2)
    const sy = Math.floor((ih - side) / 2)
    const target = Math.min(1024, Math.max(512, side))
    const canvas = document.createElement("canvas")
    canvas.width = target
    canvas.height = target
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no_ctx")
    // White background for transparent sources (PNG/WebP)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, target, target)
    ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))), mimeType, quality)
    })
    URL.revokeObjectURL(imgUrl)
    return blob
  }

  // Using ImageBitmap path
  try {
    const iw = bitmap.width
    const ih = bitmap.height
    const side = Math.max(1, Math.min(iw, ih))
    const sx = Math.floor((iw - side) / 2)
    const sy = Math.floor((ih - side) / 2)
    const target = Math.min(1024, Math.max(512, side))
    const canvas = document.createElement("canvas")
    canvas.width = target
    canvas.height = target
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no_ctx")
    // White background for transparent sources (PNG/WebP)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, target, target)
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))), mimeType, quality)
    })
    bitmap.close()
    return blob
  } finally {
    // Ensure bitmap is released even if drawing fails
    try {
      bitmap?.close()
    } catch {}
  }
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

  const s = 512
  const canvas = document.createElement("canvas")
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no_ctx")

  const blobs: Blob[] = []
  for (let i = 0; i < targetFrames; i++) {
    ctx.clearRect(0, 0, s, s)
    ctx.drawImage(img, 0, 0, s, s)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), mimeType, quality))
    blobs.push(blob)
  }
  URL.revokeObjectURL(imgUrl)
  return blobs
}
</script>

<style scoped>
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
  opacity: 0.3;
}

.video-container {
  position: relative;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}
.video-container.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #000;
}

.floating-controls {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 16px;
  z-index: 2001;
  padding: 0 12px;
}
</style>
