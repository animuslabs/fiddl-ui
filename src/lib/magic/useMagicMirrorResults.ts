import { ref, computed } from "vue"
import { useQuasar } from "quasar"
import { img } from "lib/netlifyImg"
import { toCreatePage } from "lib/routeHelpers"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { useUserAuth } from "src/stores/userAuth"
import { prices } from "src/stores/pricesStore"
import { catchErr } from "lib/util"
import type { Router } from "vue-router"

export function useMagicMirrorResults(opts: { animatedKey: string; router: Router }) {
  const quasar = useQuasar()
  const userAuth = useUserAuth()
  const vidStore = useCreateVideoStore()
  const { router, animatedKey } = opts

  // Animate dialog state
  const animateDialogOpen = ref(false)
  const animateDialogImageId = ref<string | null>(null)
  const animating = ref(false)

  // Estimated video cost
  const defaultVideoDuration = 5
  const klingCostPerSecond = computed(() => prices.video.model.kling)
  const estimatedVideoCost = computed(() => klingCostPerSecond.value * defaultVideoDuration)

  // Track which images have had animation triggered this session
  const triggeredVideoIds = ref<string[]>([])
  function loadAnimatedIds() {
    try {
      triggeredVideoIds.value = JSON.parse(sessionStorage.getItem(animatedKey) || "[]")
    } catch {}
  }
  function saveAnimatedIds() {
    try {
      sessionStorage.setItem(animatedKey, JSON.stringify(triggeredVideoIds.value))
    } catch {}
  }
  loadAnimatedIds()

  const hasAnimatedSelected = computed(() => (animateDialogImageId.value ? triggeredVideoIds.value.includes(animateDialogImageId.value) : false))

  // Video prompt countdown after triggering animation
  const animPromptVisible = ref(false)
  const animPromptSecondsLeft = ref(60)
  const animPromptReady = computed(() => animPromptSecondsLeft.value <= 0)
  const animPromptLabel = computed(() => (animPromptReady.value ? "Go to Video" : `Video available in ${formatMMSS(animPromptSecondsLeft.value)}`))
  function formatMMSS(total: number) {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }
  let animPromptTimer: number | null = null
  function startAnimPromptCountdown() {
    stopAnimPromptCountdown()
    animPromptSecondsLeft.value = 180
    animPromptVisible.value = true
    const tick = () => {
      if (animPromptSecondsLeft.value <= 0) {
        stopAnimPromptCountdown()
        return
      }
      animPromptSecondsLeft.value -= 1
      animPromptTimer = window.setTimeout(tick, 1000)
    }
    animPromptTimer = window.setTimeout(tick, 1000)
  }
  function stopAnimPromptCountdown() {
    if (animPromptTimer) window.clearTimeout(animPromptTimer)
    animPromptTimer = null
  }

  function animateImage(id: string) {
    animateDialogImageId.value = id
    animateDialogOpen.value = true
  }
  async function triggerAnimation() {
    if (!animateDialogImageId.value) return
    try {
      animating.value = true
      vidStore.setReq({ prompt: "Animate this image", model: "kling", aspectRatio: "9:16", public: false, quantity: 1, duration: defaultVideoDuration, startImageId: animateDialogImageId.value })
      await vidStore.createVideoRequest()
      void userAuth.loadUserData()
      if (!triggeredVideoIds.value.includes(animateDialogImageId.value)) {
        triggeredVideoIds.value.push(animateDialogImageId.value)
        saveAnimatedIds()
      }
      animateDialogOpen.value = false
      startAnimPromptCountdown()
      quasar.notify({ message: "Video animation started. It may take a few minutes to complete.", color: "primary" })
    } catch (e: any) {
      catchErr(e)
    } finally {
      animating.value = false
    }
  }
  function goToCreateVideo() {
    animateDialogOpen.value = false
    animPromptVisible.value = false
    stopAnimPromptCountdown()
    void toCreatePage({ model: "kling", type: "video" }, router, { noCreateModal: true })
  }

  // Media share/download helpers
  async function fetchImageBlob(id: string): Promise<Blob> {
    const url = img(id, "lg")
    const resp = await fetch(url, { mode: "cors" })
    const blob = await resp.blob()
    return blob
  }
  async function shareImage(id: string) {
    try {
      const blob = await fetchImageBlob(id)
      const filename = id + ".webp"
      const file = new File([blob], filename, { type: blob.type || "image/webp" })
      const nav: any = navigator as any
      if (nav?.canShare && nav?.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "My Magic Mirror image" })
          return
        } catch (err: any) {
          if (String(err?.name || "").toLowerCase() === "aborterror") return
        }
      }
      // Fallback: share URL or copy link
      const url = img(id, "lg")
      if (nav && typeof nav.share === "function") {
        await nav.share({ title: "My Magic Mirror image", url })
      } else {
        await navigator.clipboard.writeText(url)
        quasar.notify({ message: "Link copied to clipboard", color: "primary" })
      }
    } catch (e: any) {
      catchErr(e)
    }
  }
  async function downloadImage(id: string) {
    try {
      const blob = await fetchImageBlob(id)
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = id + ".webp"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e: any) {
      catchErr(e)
    }
  }
  async function saveToGallery(id: string) {
    try {
      const blob = await fetchImageBlob(id)
      const filename = id + ".webp"
      const file = new File([blob], filename, { type: blob.type || "image/webp" })
      const nav: any = navigator as any
      if (nav?.canShare && nav?.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "Magic Mirror" })
          quasar.notify({ message: "Opened share sheet", color: "primary" })
          return
        } catch (err: any) {
          if (String(err?.name || "").toLowerCase() === "aborterror") return
        }
      }
      // Fallback to normal download
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e: any) {
      catchErr(e)
    }
  }

  return {
    // Share/Download helpers
    shareImage,
    downloadImage,
    saveToGallery,
    // Animate dialog + actions
    animateImage,
    triggerAnimation,
    goToCreateVideo,
    animateDialogOpen,
    animateDialogImageId,
    animating,
    // Video prompt toast
    animPromptVisible,
    animPromptReady,
    animPromptLabel,
    startAnimPromptCountdown,
    stopAnimPromptCountdown,
    // Estimated cost + triggered tracking
    defaultVideoDuration,
    estimatedVideoCost,
    hasAnimatedSelected,
    triggeredVideoIds,
  }
}

