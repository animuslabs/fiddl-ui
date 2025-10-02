import { ref, computed } from "vue"
import { useQuasar } from "quasar"
import { img } from "lib/netlifyImg"
import { hdDownloadUrl, originalDownloadUrl } from "src/lib/imageCdn"
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
  // Quick buy points dialog for insufficient credits
  const quickBuyDialogOpen = ref(false)

  const availablePoints = computed(() => userAuth.userData?.availablePoints || 0)

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
      // Check points before creating the request
      const required = estimatedVideoCost.value
      if (availablePoints.value < required) {
        quasar.notify({ color: "negative", message: `Not enough Fiddl Points. Need ${required} points.` })
        quickBuyDialogOpen.value = true
        return
      }
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
      const url = img(id, "lg")
      const tg: any = (window as any)?.Telegram?.WebApp
      const inTma = Boolean((window as any)?.__TMA__?.enabled && tg)

      // First-class Telegram share inside Mini App
      if (inTma) {
        try {
          // Prefer sharing the actual image to Telegram Story if supported
          const origUrl = await originalDownloadUrl(id).catch(() => url)
          const canStory = typeof tg?.shareToStory === "function" && /\.(png|jpe?g)$/i.test(origUrl)
          if (canStory) {
            try {
              tg.shareToStory(origUrl, {
                text: "Made with Fiddl.art",
                widget_link: { url: window.location.origin, text: "Open Fiddl.art" },
              })
              return
            } catch {}
          }
          // Fallback to "share link" flow inside Telegram
          const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Check out my Magic Mirror image")}`
          if (typeof tg?.openTelegramLink === "function") {
            tg.openTelegramLink(shareUrl)
            return
          }
        } catch {}
        // If anything above fails, fall back to Web Share / clipboard
      }

      // Outside Telegram (or as fallback): try Web Share with file first
      const nav: any = navigator as any
      try {
        const blob = await fetch(url, { mode: "cors" }).then((r) => r.blob())
        const filename = id + ".webp"
        const file = new File([blob], filename, { type: blob.type || "image/webp" })
        if (nav?.canShare && nav?.canShare({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: "My Magic Mirror image" })
            return
          } catch (err: any) {
            if (String(err?.name || "").toLowerCase() === "aborterror") return
          }
        }
      } catch {}

      // Fallback: share URL or copy link
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
      const tg: any = (window as any)?.Telegram?.WebApp
      const inTma = Boolean((window as any)?.__TMA__?.enabled && tg)

      // Prefer server-proxied HD download URL with filename when in Telegram
      const dlUrl = await hdDownloadUrl(id).catch(async () => img(id, "lg"))
      const filename = `${id}.webp`
      if (inTma && typeof tg?.downloadFile === "function") {
        try {
          const params: any = { url: dlUrl, file_name: filename, filename }
          tg.downloadFile(params, () => {})
          return
        } catch {}
      }

      // Outside Telegram (or fallback): fetch and trigger browser download
      const resp = await fetch(dlUrl, { mode: "cors" })
      const blob = await resp.blob()
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
  async function saveToGallery(id: string) {
    try {
      // Prefer original PNG for gallery saves if available, else HD webp
      const orig = await originalDownloadUrl(id).catch(() => "")
      const usePng = /\.png$/i.test(orig)
      const url = usePng ? orig : await hdDownloadUrl(id).catch(() => img(id, "lg"))
      const filename = id + (usePng ? ".png" : ".webp")
      const tg: any = (window as any)?.Telegram?.WebApp
      const inTma = Boolean((window as any)?.__TMA__?.enabled && tg)

      // Prefer native Telegram download prompt when in TMA
      if (inTma && typeof tg?.downloadFile === "function") {
        try {
          const params: any = { url, file_name: filename, filename }
          tg.downloadFile(params, (_ok: boolean) => {
            // No-op; Telegram shows its own UI. We could notify on cancel if desired.
          })
          return
        } catch {}
      }

      // Outside Telegram (or if Telegram download fails), try Web Share with file (common pattern for iOS gallery save)
      try {
        const resp = await fetch(url, { mode: "cors" })
        const blob = await resp.blob()
        const file = new File([blob], filename, { type: blob.type || "image/webp" })
        const nav: any = navigator as any
        if (nav?.canShare && nav?.canShare({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: "Save image" })
            quasar.notify({ message: "Opened share sheet", color: "primary" })
            return
          } catch (err: any) {
            if (String(err?.name || "").toLowerCase() === "aborterror") return
          }
        }
        // Fallback to traditional download
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = objectUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(objectUrl)
      } catch (e) {
        // As last resort, copy link
        await navigator.clipboard.writeText(url)
        quasar.notify({ message: "Link copied to clipboard", color: "primary" })
      }
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
    // Quick buy dialog
    quickBuyDialogOpen,
  }
}
