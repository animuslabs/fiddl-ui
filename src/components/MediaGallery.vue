<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue"
import { useQuasar, LocalStorage } from "quasar"
import { Dialog, Loading } from "quasar"
// Import removed: unified flow uses route-based orchestrator to open quick-edit
// no need to pre-upload input image; we operate by id now
import { useRouter } from "vue-router"
import { img, s3Video, avatarImg } from "lib/netlifyImg"
import type { ImageSize } from "fiddl-server/dist/lib/types/serverTypes"
import mediaViwer, { COMMENT_DIALOG_SENTINEL } from "lib/mediaViewer"
import { usePopularityStore } from "src/stores/popularityStore"
import { useUserAuth } from "src/stores/userAuth"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { isOwned } from "lib/ownedMediaCache"
import LikeMedia from "src/components/dialogs/LikeMedia.vue"
import UnlockForInput from "src/components/dialogs/UnlockForInput.vue"
import type { MediaType } from "lib/types"
import type { MediaGalleryMeta } from "src/types/media-gallery"
import { creationsSetRequestPrivacy, creationsDeleteRequest, creationsDeleteMedia } from "lib/orval"
import { prices } from "stores/pricesStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useVideoCreations } from "src/stores/videoCreationsStore"
import { getCachedAspectRatio, rememberAspectRatio } from "lib/aspectRatio"

export type { MediaGalleryMeta }

const props = withDefaults(
  defineProps<{
    mediaObjects: MediaGalleryMeta[]
    layout?: "grid" | "mosaic"
    colsDesktop?: number
    colsMobile?: number
    gap?: number | string
    thumbSizeDesktop?: number
    thumbSizeMobile?: number
    selectable?: boolean
    // IDs marked as selected (for external multi-select UIs)
    selectedIds?: string[]
    rowHeightRatio?: number
    showLoading?: boolean
    centerAlign?: boolean
    showPopularity?: boolean
    showVisibilityToggle?: boolean
    showDeleteButton?: boolean
    // When true, do not gate or mask NSFW items
    disableNsfwMask?: boolean
    // Show overlay button to use an image as input in Create page
    showUseAsInput?: boolean
    // Enable tap-to-select behavior on the model chip overlay
    enableModelChipSelect?: boolean
    // Reserve vertical space (in px) above/below media for controls.
    // When > 0, controls render in bars instead of overlaid, and the grid/mosaic
    // layout will account for the extra height so tiles never overlap.
    topBarHeight?: number | string
    bottomBarHeight?: number | string
    // When true, show small creator avatar+name in the reserved bottom bar
    showCreator?: boolean
    // External loading flag to force initial skeletons (e.g., browse feed)
    skeletonLoading?: boolean
  }>(),
  {
    layout: "grid",
    colsDesktop: 4,
    colsMobile: 2,
    gap: "8px",
    thumbSizeDesktop: 200,
    thumbSizeMobile: 120,
    selectable: false,
    selectedIds: undefined,
    rowHeightRatio: 1.2,
    showLoading: true,
    centerAlign: false,
    showPopularity: false,
    showVisibilityToggle: false,
    showDeleteButton: false,
    disableNsfwMask: false,
    showUseAsInput: false,
    enableModelChipSelect: false,
    topBarHeight: 0,
    bottomBarHeight: 0,
    showCreator: false,
    skeletonLoading: false,
  },
)

// Loading and reload keys for media; keys are added only when item mounts/visible
const videoLoading = ref<Record<string, boolean>>({})
const videoReloadKey = ref<Record<string, number>>({})
const imageLoading = ref<Record<string, boolean>>({})
const imageReloadKey = ref<Record<string, number>>({})

const VIDEO_RETRY_BASE_DELAY_MS = 1500
const VIDEO_RETRY_MAX_DELAY_MS = 20000
const VIDEO_PLAYBACK_BASE_DELAY_MS = 700
const VIDEO_PLAYBACK_MAX_DELAY_MS = 12000

type VideoRetryEntry = { attempts: number; timer: number | null }
const videoRetryState = new Map<string, VideoRetryEntry>()

type VideoPlaybackEntry = { attempts: number; timer: number | null }
const videoPlaybackState = new Map<string, VideoPlaybackEntry>()

function cancelVideoRetryTimer(id: string) {
  const entry = videoRetryState.get(id)
  if (!entry || entry.timer == null) return
  if (typeof window !== "undefined") {
    window.clearTimeout(entry.timer)
  }
  entry.timer = null
}

function clearVideoRetryState(id: string) {
  cancelVideoRetryTimer(id)
  videoRetryState.delete(id)
}

function scheduleVideoRetry(id: string) {
  if (typeof window === "undefined") return
  const previous = videoRetryState.get(id)
  const attempts = (previous?.attempts ?? 0) + 1
  cancelVideoRetryTimer(id)
  const delay = Math.min(VIDEO_RETRY_MAX_DELAY_MS, VIDEO_RETRY_BASE_DELAY_MS * attempts)
  const entry: VideoRetryEntry = { attempts, timer: null }
  entry.timer = window.setTimeout(() => {
    const current = videoRetryState.get(id)
    if (!current) return
    current.timer = null
    videoLoading.value[id] = true
    videoReloadKey.value[id] = Date.now()
  }, delay) as unknown as number
  videoRetryState.set(id, entry)
}

function cancelVideoPlaybackTimer(id: string) {
  const entry = videoPlaybackState.get(id)
  if (!entry || entry.timer == null) return
  if (typeof window !== "undefined") {
    window.clearTimeout(entry.timer)
  }
  entry.timer = null
}

function clearVideoPlaybackState(id: string) {
  cancelVideoPlaybackTimer(id)
  videoPlaybackState.delete(id)
}

function schedulePlaybackRetry(id: string, attempt: number) {
  if (typeof window === "undefined") return
  const delay = Math.min(VIDEO_PLAYBACK_MAX_DELAY_MS, VIDEO_PLAYBACK_BASE_DELAY_MS * Math.max(1, attempt))
  cancelVideoPlaybackTimer(id)
  const entry: VideoPlaybackEntry = { attempts: attempt, timer: null }
  entry.timer = window.setTimeout(() => {
    ensureVideoLooping(id, attempt)
  }, delay) as unknown as number
  videoPlaybackState.set(id, entry)
}

function ensureVideoLooping(id: string, attempt = 0): void {
  cancelVideoPlaybackTimer(id)
  if (typeof document === "undefined") {
    schedulePlaybackRetry(id, attempt + 1)
    return
  }
  const videoEl = document.querySelector(`video[data-id="${id}"]`) as HTMLVideoElement | null
  if (!videoEl) {
    schedulePlaybackRetry(id, attempt + 1)
    return
  }
  const ready = videoEl.readyState >= 2
  const playing = ready && !videoEl.paused && videoEl.currentTime > 0 && !videoEl.ended
  if (playing) {
    clearVideoPlaybackState(id)
    return
  }
  const queueNext = () => {
    schedulePlaybackRetry(id, attempt + 1)
  }
  if (ready) {
    try {
      const playResult = videoEl.play()
      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => {
            if (videoEl.paused) {
              queueNext()
            } else {
              clearVideoPlaybackState(id)
            }
          })
          .catch(() => {
            queueNext()
          })
        return
      }
    } catch {
      queueNext()
      return
    }
    if (!videoEl.paused) {
      clearVideoPlaybackState(id)
    } else {
      queueNext()
    }
  } else {
    queueNext()
  }
}

// ----- Mobile pinch-to-zoom (ephemeral) -----
// Shows a temporary fixed overlay while user pinches an image tile on mobile.
// When they release, the image snaps back and overlay hides.
const pinchActiveId = ref<string | null>(null)
const pinchImageUrl = ref<string>("")
const pinchScale = ref(1)
const pinchOrigin = ref({ x: 0, y: 0 }) // transform-origin within the tile rect
const pinchStartDistance = ref(0)
const pinchStartRect = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const pinchSuppressClick = ref(false)
// Computed inline style for the pinch overlay image to avoid long inline Pug expression
const pinchImageStyle = computed(() => {
  const r = pinchStartRect.value
  return {
    left: ((r?.left ?? 0) as number) + "px",
    top: ((r?.top ?? 0) as number) + "px",
    width: ((r?.width ?? 0) as number) + "px",
    height: ((r?.height ?? 0) as number) + "px",
    transformOrigin: `${pinchOrigin.value.x}px ${pinchOrigin.value.y}px`,
    transform: `scale(${pinchScale.value})`,
  } as Record<string, string>
})

function getTouches(ev: TouchEvent): [Touch, Touch] | null {
  if (!ev || !ev.touches || ev.touches.length < 2) return null
  const t1 = typeof ev.touches.item === "function" ? ev.touches.item(0) : (ev.touches[0] as Touch | undefined)
  const t2 = typeof ev.touches.item === "function" ? ev.touches.item(1) : (ev.touches[1] as Touch | undefined)
  if (!t1 || !t2) return null
  return [t1, t2]
}

function dist(a: Touch, b: Touch): number {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

function onPinchStart(ev: TouchEvent, m: MediaGalleryMeta) {
  try {
    if (!isMobile.value) return
    const pair = getTouches(ev)
    if (!pair) return
    // Avoid interfering with NSFW mask or placeholders
    if (shouldMaskNsfw(m) || m.placeholder) return

    const [t1, t2] = pair
    const target = ev.target as HTMLElement | null
    // Find the media box element to measure initial rect
    const host = (target?.closest?.(".media-aspect") || target?.closest?.(".media-fill") || target) as HTMLElement | null
    const rect = host?.getBoundingClientRect?.()
    if (!rect) return

    pinchActiveId.value = m.id
    pinchImageUrl.value = m.url || img(String(m.id), "lg")
    pinchStartRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    pinchStartDistance.value = dist(t1, t2)
    // Center between touches relative to the host top-left for transform-origin
    const cx = (t1.clientX + t2.clientX) / 2
    const cy = (t1.clientY + t2.clientY) / 2
    pinchOrigin.value = { x: cx - rect.left, y: cy - rect.top }
    pinchScale.value = 1
    pinchSuppressClick.value = true
    // Prevent the page from scrolling/zooming while active
    ev.preventDefault()
  } catch {}
}

function onPinchMove(ev: TouchEvent) {
  try {
    if (!pinchActiveId.value) return
    const pair = getTouches(ev)
    if (!pair) return
    const [t1, t2] = pair
    const start = pinchStartRect.value
    if (!start || !pinchStartDistance.value) return
    const currentDist = dist(t1, t2)
    let scale = currentDist / pinchStartDistance.value
    // Clamp scale for a reasonable zoom range
    scale = Math.max(1, Math.min(3, scale))
    pinchScale.value = scale
    // Update origin to follow finger midpoint (relative to initial rect)
    const cx = (t1.clientX + t2.clientX) / 2
    const cy = (t1.clientY + t2.clientY) / 2
    pinchOrigin.value = { x: cx - start.left, y: cy - start.top }
    ev.preventDefault()
  } catch {}
}

function onPinchEnd(ev: TouchEvent) {
  try {
    if (!pinchActiveId.value) return
    // If still two touches remain, ignore; otherwise snap back and hide
    if (ev.touches && ev.touches.length >= 2) return
    // Snap back animation: set scale to 1, then clear overlay after a tick
    pinchScale.value = 1
    const clear = () => {
      pinchActiveId.value = null
      pinchImageUrl.value = ""
      pinchStartRect.value = null
    }
    // Give CSS transition a moment (matches 120ms in styles)
    window.setTimeout(clear, 140)
    // Suppress the click that follows touchend so we don't open the viewer
    window.setTimeout(() => {
      pinchSuppressClick.value = false
    }, 200)
    ev.preventDefault()
  } catch {}
}

// Progressive image upgrade state
const imageTargetSize = ref<Record<string, ImageSize>>({})
const imageCurrentSize = ref<Record<string, ImageSize>>({})
const imageUpgradeQueue = ref<Record<string, ImageSize[]>>({})
const imageUpgradeAttempts = ref<Record<string, Partial<Record<ImageSize, number>>>>({})
const imageUpgradeInFlight = ref<Record<string, boolean>>({})
const previewInitialSize: ImageSize = "sm"
const previewUpgradeTarget: ImageSize = "md"
const sizeRank: Record<string, number> = { xs: 0, sm: 1, md: 2, lg: 3, xl: 4, hd: 5 }
let imageUpgradeTimer: number | null = null
const UPGRADE_INTERVAL_MS = 2000
const MAX_ATTEMPTS_PER_SIZE = 30
const SKELETON_COUNT = 30
const skeletonSeed = ref<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
const videoSources = ref<Record<string, string>>({})

function getSizeRank(size: ImageSize): number {
  return sizeRank[String(size)] ?? 99
}

function createSeededRandom(seed: number) {
  let t = (seed ^ 0x6d2b79f5) >>> 0
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function reseedSkeletons() {
  skeletonSeed.value = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
}

function videoPosterFor(id: string | number): string {
  return s3Video(String(id), "thumbnail")
}

function queueVideoSrc(id: string) {
  if (videoSources.value[id]) return
  const preview = s3Video(id, "preview-md")
  if (typeof window === "undefined") {
    videoSources.value[id] = preview
    return
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      videoSources.value[id] = preview
    })
  })
}

function hasVideoSource(id: string): boolean {
  return typeof videoSources.value[id] === "string" && videoSources.value[id].length > 0
}

// Intersection-based visibility map to unmount offscreen media
const visibleMap = ref<Record<string, boolean>>({})
type ObserveBinding = string // media id

// Preload/unmount buffer around viewport to avoid thrash
const OBSERVER_ROOT_MARGIN = "800px"
// Secondary IO for a wider "near viewport" band used to decide soft culling
const NEAR_OBSERVER_ROOT_MARGIN = "1800px"

// Local directive to observe an element and toggle visibility for its media id
let sharedIO: IntersectionObserver | null = null
const ioTargets = new Map<Element, string>()
function getSharedIO(): IntersectionObserver {
  if (sharedIO) return sharedIO
  sharedIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = ioTargets.get(entry.target)
        if (!id) continue
        visibleMap.value[id] = entry.isIntersecting
      }
    },
    { root: null, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 },
  )
  return sharedIO
}
// Wider-band observer to detect items near the viewport (avoid overzealous culling)
const nearVisibleMap = ref<Record<string, boolean>>({})
let nearIO: IntersectionObserver | null = null
const nearTargets = new Map<Element, string>()
function getNearIO(): IntersectionObserver {
  if (nearIO) return nearIO
  nearIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = nearTargets.get(entry.target)
        if (!id) continue
        // Mark true when within the larger margin band
        nearVisibleMap.value[id] = entry.isIntersecting
      }
    },
    { root: null, rootMargin: NEAR_OBSERVER_ROOT_MARGIN, threshold: 0 },
  )
  return nearIO
}
const vObserveNear: import("vue").Directive<HTMLElement, ObserveBinding> = {
  mounted(el, binding) {
    const id = binding.value
    if (!id) return
    nearTargets.set(el, id)
    getNearIO().observe(el)
  },
  unmounted(el, binding) {
    const id = binding.value
    if (id) delete nearVisibleMap.value[id]
    nearTargets.delete(el)
    if (nearIO) nearIO.unobserve(el)
  },
}
const vObserve: import("vue").Directive<HTMLElement, ObserveBinding> = {
  mounted(el, binding) {
    const id = binding.value
    if (!id) return
    ioTargets.set(el, id)
    getSharedIO().observe(el)
  },
  unmounted(el, binding) {
    const id = binding.value
    if (id) delete visibleMap.value[id]
    ioTargets.delete(el)
    if (sharedIO) sharedIO.unobserve(el)
  },
}

const emit = defineEmits<{
  (e: "select", payload: { id: string; type: "image" | "video" }): void
  (e: "selectedIndex", index: number): void
  (e: "modelSelect", payload: { model: string; customModelId?: string | null; customModelName?: string | null; mediaId: string; mediaType: "image" | "video" }): void
}>()

const $q = useQuasar()
const userAuth = useUserAuth()
const mediaViewerStore = useMediaViewerStore()
const router = useRouter()
const isMobile = computed(() => $q.screen.lt.md)
const isPhone = computed(() => $q.screen.lt.sm)
// Effective layout mirrors prop; parent decides default. We adapt behavior per screen.
const layoutEffective = computed<"grid" | "mosaic">(() => props.layout)
const cols = computed(() => {
  // Phones: single column for grid; allow 2 columns for mosaic if ever enabled
  if (isPhone.value) return layoutEffective.value === "mosaic" ? 2 : 1
  // Small screens (e.g., small tablets): use mobile setting
  if ($q.screen.lt.md) return props.colsMobile
  // Desktop and up
  return props.colsDesktop
})
const thumbSize = computed(() => (isMobile.value ? props.thumbSizeMobile : props.thumbSizeDesktop))
// Minimum visual size for grid tiles to avoid pop as content swaps
const gridMinSize = computed(() => {
  const base = Number(thumbSize.value) || 0
  // Clamp to a sensible range so phones don't look huge
  return Math.min(Math.max(base, 120), 260)
})
const gapValue = computed(() => (typeof props.gap === "number" ? `${props.gap}px` : props.gap))
// Numeric gap in px for calculations
const gapPx = computed(() => toPxNumber(gapValue.value))
const popularity = usePopularityStore()
// Popularity button sizing: slightly reduced on phones (−20%)
const popIconSize = computed(() => {
  if (isPhone.value) {
    // Previously 18px (grid) and 10px (mosaic) on phones
    // Reduce by 20% to make targets a bit more compact
    return layoutEffective.value === "grid" ? "10px" : "8px"
  }
  return "8px"
})

// Decide per-item popularity layout: inline vs stacked on mobile
function popularityLayoutClass(m: MediaGalleryMeta) {
  try {
    const ratio = typeof m?.aspectRatio === "number" && Number.isFinite(m.aspectRatio) ? m.aspectRatio : 1
    const stacked = $q.screen.lt.md && ratio < 0.95 // stack on tall/narrow tiles only
    return { "stack-mobile": stacked, "mode-grid": layoutEffective.value === "grid", "mode-mosaic": layoutEffective.value === "mosaic" }
  } catch {
    return {}
  }
}

const imageCreations = useImageCreations()
const videoCreations = useVideoCreations()
// Access create-image flow to coordinate placeholder cleanup on errors/completion
const createImageStore = useCreateImageStore()
const privacyLoading = ref<Record<string, boolean>>({})
const deleteLoading = ref<Record<string, boolean>>({})
const addInputLoading = ref<Record<string, boolean>>({})

const NSFW_PREFERENCE_KEY = "fiddl:showNsfwMedia"
const storedNsfwPref = LocalStorage.getItem<boolean>(NSFW_PREFERENCE_KEY)
const showNsfwContent = ref(storedNsfwPref === true)
let nsfwDialogPromise: Promise<boolean> | null = null

// Helper: pick a lightweight background image for bar blur
function barBgUrlFor(m: MediaGalleryMeta): string {
  try {
    // For pending placeholders, avoid fetching anything (use 1x1 transparent pixel)
    if (isPendingItem(m)) return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
    // Prefer smaller assets for the blurred backdrop
    // For videos, use the static thumbnail for stable/lightweight blur
    if ((m.type ?? m.mediaType) === "video") return s3Video(m.id, "thumbnail")
    return img(String(m.id), "sm")
  } catch {
    return m.url || ""
  }
}

// Treat items with a temporary id or explicit placeholder flag as "pending generation"
function isPendingItem(m: MediaGalleryMeta): boolean {
  try {
    return (typeof m?.id === "string" && m.id.startsWith("pending-")) || m?.placeholder === true
  } catch {
    return false
  }
}

const privateTaxPercent = computed(() => {
  const tax = prices.privateTax
  return typeof tax === "number" && Number.isFinite(tax) ? Math.max(0, tax) : 0
})

const privateTaxRate = computed(() => privateTaxPercent.value / 100)

/**
 * Popularity polling (use setTimeout loop to avoid overlap; pause when tab hidden)
 * Note: using a timeout loop prevents stacking requests when the network is slow.
 */
const pollIntervalMs = 30000
let popularityPollTimer: number | null = null

// Video reload retry timer (moved from global setInterval)
let videoReloadTimer: number | null = null

// Ephemeral "+N" burst UI for upvotes
type UpvoteBurst = { count: number; visible: boolean; timer?: number }
const upvoteBursts = ref<Record<string, UpvoteBurst>>({})

function onUpvote(id: string, type: MediaType) {
  if (!userAuth.loggedIn) {
    Dialog.create({
      title: "Login required",
      message: "You get free upvotes each day, but you need to login first.",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void router.push({ name: "login" })
    })
    return
  }
  triggerUpvoteBurst(id)
  void popularity.addUpvote(id, type)
}

function triggerUpvoteBurst(id: string) {
  const cur = upvoteBursts.value[id] || { count: 0, visible: false }
  const next: UpvoteBurst = { ...cur, count: cur.count + 1, visible: true }
  if (next.timer) window.clearTimeout(next.timer)
  next.timer = window.setTimeout(() => {
    // hide and reset count after a short delay
    upvoteBursts.value[id] = { count: 0, visible: false }
  }, 1800) as unknown as number
  upvoteBursts.value[id] = next
}

function ownsMediaQuick(id: string, type: MediaType): boolean {
  // Treat my own creations as owned (no unlock prompt)
  try {
    if (type === "image") {
      // Created by me?
      if (imageCreations?.allCreations?.some((c) => c.id === id)) return true
      // Purchased/unlocked list loaded?
      if (imageCreations?.imagePurchases?.some((p: any) => p.imageId === id)) return true
    } else {
      if (videoCreations?.allCreations?.some((c) => c.id === id)) return true
      if (videoCreations?.imagePurchases?.some((p: any) => p.videoId === id)) return true
    }
  } catch {}

  // Local cached ownership/unlock signals
  if (isOwned(id, type)) return true
  if (type === "video") {
    if (mediaViewerStore.hdVideoUrl[id]) return true
    const cached = LocalStorage.getItem<string>("hdVideoUrl-" + id)
    if (cached) return true
  } else {
    if (mediaViewerStore.hdImageSrc[id]) return true
  }
  return false
}

function setStoredNsfwPreference(value: boolean | null) {
  if (value === null) {
    LocalStorage.remove(NSFW_PREFERENCE_KEY)
  } else {
    LocalStorage.set(NSFW_PREFERENCE_KEY, value)
  }
}

function shouldMaskNsfw(media: MediaGalleryMeta | undefined): boolean {
  if (!media) return false
  // Allow callers (e.g., Create page) to bypass masking entirely
  if (props.disableNsfwMask === true) return false
  return media.nsfw === true && !showNsfwContent.value
}

function promptNsfwConsent(): Promise<boolean> {
  if (nsfwDialogPromise) return nsfwDialogPromise

  const checkboxModel: string[] = []

  nsfwDialogPromise = new Promise((resolve) => {
    let resolved = false
    const finish = (proceed: boolean) => {
      if (resolved) return
      resolved = true
      const remember = checkboxModel.includes("remember")
      if (proceed) {
        showNsfwContent.value = true
        if (remember) setStoredNsfwPreference(true)
        else setStoredNsfwPreference(null)
      } else if (remember) {
        setStoredNsfwPreference(false)
      }
      nsfwDialogPromise = null
      resolve(proceed)
    }

    const dialog = Dialog.create({
      title: "NSFW Content",
      message: "Do you want to show NSFW content?",
      cancel: { label: "Cancel" },
      ok: { label: "Show" },
      persistent: true,
      options: {
        type: "checkbox",
        model: checkboxModel,
        items: [{ label: "Remember my preference", value: "remember" }],
      },
    })

    dialog.onOk(() => finish(true))
    dialog.onCancel(() => finish(false))
    dialog.onDismiss(() => finish(false))
  })

  return nsfwDialogPromise
}

async function handleSelect(media: MediaGalleryMeta, index: number) {
  if (!media?.id || media.placeholder === true) return

  if (shouldMaskNsfw(media)) {
    const proceed = await promptNsfwConsent()
    if (!proceed) return
  }

  const type = (media.type ?? media.mediaType ?? (isVideoMedia(media) ? "video" : "image")) as "image" | "video"
  emit("select", { id: media.id, type })
  emit("selectedIndex", index)
}

// Wrap image click to avoid firing after a pinch gesture
function onImageClick(media: MediaGalleryMeta, index: number) {
  if (pinchSuppressClick.value) return
  void handleSelect(media, index)
}

function onFavorite(id: string, type: MediaType) {
  if (!userAuth.loggedIn) {
    Dialog.create({
      title: "Login required",
      message: "You need to login to like media",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void router.push({ name: "login" })
    })
    return
  }

  const isFav = !!popularity.get(id)?.isFavoritedByMe
  // Unfavorite path: allow immediately
  if (isFav) {
    void popularity.toggleFavorite(id, type)
    return
  }

  // Favorite path: gate instantly if not unlocked
  if (!ownsMediaQuick(id, type)) {
    Dialog.create({
      component: LikeMedia,
      componentProps: { type, userOwnsMedia: false, currentMediaId: id },
    }).onOk(() => {
      void popularity.toggleFavorite(id, type)
    })
    return
  }

  // User owns/unlocked -> proceed
  void popularity.toggleFavorite(id, type)
}

function openCommentsFromOverlay(media: MediaGalleryMeta) {
  if (!media?.id || media.placeholder === true) return
  const items = galleryItems.value
  if (!items.length) return
  const startId = media.id
  const allowDelete = !!props.showDeleteButton
  // Use id-based navigation to avoid index drift when placeholders are present
  void (mediaViwer as any).showById(items, startId, allowDelete, { initialCommentId: COMMENT_DIALOG_SENTINEL })
}

async function addAsInput(imageId: string) {
  try {
    if (!imageId) return
    // Require login similar to favorite flow
    if (!userAuth.loggedIn) {
      Dialog.create({
        title: "Login required",
        message: "You need to login to use an image as input.",
        cancel: true,
        persistent: true,
      }).onOk(() => {
        void router.push({ name: "login" })
      })
      return
    }
    // Require unlock/ownership; show tailored unlock-to-edit dialog
    if (!ownsMediaQuick(imageId, "image")) {
      Dialog.create({
        component: UnlockForInput,
        componentProps: { type: "image", currentMediaId: imageId },
      }).onOk(() => {
        // After unlock, retry adding as input
        void addAsInput(imageId)
      })
      return
    }
    addInputLoading.value[imageId] = true
    // Route-based unified flow: let the Create page orchestrator
    // open the same InputImageQuickEdit component with default model.
    // Suppress the create panel on mobile for this navigation; the quick-edit dialog will guide the user.
    try {
      if ($q.screen.lt.md) Loading.show({ message: "Opening editor…" })
    } catch {}
    void router.push({ name: "create", params: { activeTab: "image" }, query: { inputImageId: imageId, noCreateModal: "1" } })
  } catch (e) {
    console.error(e)
  } finally {
    addInputLoading.value[imageId] = false
  }
}

const wrapperStyles = computed(() => {
  const isMosaic = layoutEffective.value === "mosaic"
  const base: Record<string, string> = {
    display: "grid",
    gap: gapValue.value,
    width: "100%",
    maxWidth: "100%",
    minWidth: "0",
    overflowX: "clip",
    boxSizing: "border-box",
  }

  // On phones: grid uses single column; mosaic (if enabled) uses two slim columns
  if (isPhone.value) {
    const phoneCols = isMosaic ? 2 : 1
    base.gridTemplateColumns = `repeat(${phoneCols}, 1fr)`
    if (isMosaic) {
      base.gridAutoRows = `${thumbSize.value * props.rowHeightRatio}px`
      base.gridAutoFlow = "dense"
    }
    return base
  }

  if (isMosaic && props.centerAlign) {
    base.gridTemplateColumns = `repeat(${cols.value}, ${thumbSize.value}px)`
    base.gridAutoRows = `${thumbSize.value * props.rowHeightRatio}px`
    base.gridAutoFlow = "dense"
    base.justifyContent = "center"
  } else {
    // Revert to fluid columns that shrink to fit container to avoid overflow at tablet sizes
    base.gridTemplateColumns = `repeat(${cols.value}, 1fr)`
    if (isMosaic) {
      base.gridAutoRows = `${thumbSize.value * props.rowHeightRatio}px`
      base.gridAutoFlow = "dense"
    }
  }

  return base
})

// Fast lookup for selection state
const selectedSet = computed(() => new Set(props.selectedIds || []))

// ----- Reserved control bars (top/bottom) -----
function toPxNumber(v: number | string | undefined | null): number {
  if (v == null) return 0
  if (typeof v === "number") return isFinite(v) ? v : 0
  const trim = String(v).trim()
  if (trim.endsWith("px")) return Number(parseFloat(trim)) || 0
  const n = Number(trim)
  return isFinite(n) ? n : 0
}

const topBarPx = computed(() => toPxNumber(props.topBarHeight))
const bottomBarPx = computed(() => toPxNumber(props.bottomBarHeight))
// Use reserved bars (black padding) only on smaller screens.
// On larger screens we revert to overlay controls regardless of provided heights.
const useReservedBars = computed(() => $q.screen.lt.md && (topBarPx.value > 0 || bottomBarPx.value > 0))

// Ensure bar heights are adequate for current icon size, especially on phones
const iconPxNum = computed(() => toPxNumber(popIconSize.value as unknown as string))
// Mobile scales bars a bit larger to avoid overflow with bigger icons
const mobileBarScale = computed(() => (isPhone.value ? 1 : 1))
const effectiveTopBarPx = computed(() => {
  if (topBarPx.value <= 0) return 0
  const minPad = isPhone.value ? iconPxNum.value + 10 : iconPxNum.value + 8
  // Ensure enough room for comfortable padding even in grid
  const minForLayout = isPhone.value ? 28 : 24
  const base = Math.max(topBarPx.value, minPad, minForLayout)
  return Math.round(base * mobileBarScale.value)
})
const effectiveBottomBarPx = computed(() => {
  if (bottomBarPx.value <= 0) return 0
  // Slightly larger to fit counts comfortably on phones
  const minPad = isPhone.value ? iconPxNum.value + 16 : iconPxNum.value + 12
  // Account for text size (~12px) plus padding so controls don't feel cramped
  const minForText = isPhone.value ? 34 : 28
  const base = Math.max(bottomBarPx.value, minPad, minForText)
  // Make the bottom bar ~10% slimmer while keeping sensible minimums
  const scaled = base * 0.9
  const floorMin = Math.max(minForText * 0.9, 22) // never get comically tiny
  return Math.round(Math.max(scaled, floorMin) * mobileBarScale.value)
})

// ----- Actual column width measurement (fixes mosaic cropping on mobile) -----
// We need the real column width in px to compute accurate row spans in mosaic
// when template columns are fluid (1fr). Using thumbSize as a proxy underestimates
// width on wide phones/tablets and leads to vertical cropping.
const gridRef = ref<HTMLElement | null>(null)
const containerWidthPx = ref(0)
let ro: ResizeObserver | null = null

function updateContainerWidth() {
  try {
    containerWidthPx.value = Math.max(0, Math.round(gridRef.value?.clientWidth || 0))
  } catch {
    containerWidthPx.value = 0
  }
}

onMounted(() => {
  nextTick(() => {
    updateContainerWidth()
    if (gridRef.value && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateContainerWidth()
        // Clear cached spans so items recompute with new measurements
        layoutSpans.value = {}
      })
      ro.observe(gridRef.value)
    }
  })
  window.addEventListener("orientationchange", updateContainerWidth)
  window.addEventListener("resize", updateContainerWidth)
})

onUnmounted(() => {
  try {
    ro?.disconnect()
  } catch {}
  ro = null
  window.removeEventListener("orientationchange", updateContainerWidth)
  window.removeEventListener("resize", updateContainerWidth)
})

// Compute the actual single-column width of the mosaic grid, accounting for gaps.
const mosaicColWidthPx = computed(() => {
  if (layoutEffective.value !== "mosaic") return 0
  const n = Math.max(1, Number(cols.value) || 1)
  // When columns are fixed (centerAlign on desktop), use thumbSize directly
  const usingFixedCols = !isPhone.value && props.centerAlign === true
  if (usingFixedCols) return Number(thumbSize.value) || 0
  const container = containerWidthPx.value
  if (!container) return Number(thumbSize.value) || 0
  const totalGaps = gapPx.value * (n - 1)
  const available = Math.max(0, container - totalGaps)
  return available / n
})

// Wrapper style for each tile’s inner container that holds media and optional bars
const mediaWrapperStyle = computed(() => {
  const base: Record<string, string> = {
    width: "100%",
    display: useReservedBars.value ? "flex" : "block",
  }
  if (useReservedBars.value) {
    base["flex-direction"] = "column"
    // In mosaic we must constrain the wrapper to the grid tile height
    if (layoutEffective.value === "mosaic") base.height = "100%"
  }

  // Grid mode: keep square media area via an inner aspect box; for overlay mode we
  // continue to set aspect ratio on the wrapper for backward-compat.
  if (!useReservedBars.value) {
    if (layoutEffective.value === "grid") {
      // Important: let aspect-ratio compute the height. If we force height:100%
      // without an explicit parent height, the box collapses to the min-height
      // fallback and appears as a thin strip until the image loads.
      // Using height:auto here makes the placeholder square and avoids layout jump.
      base.height = "auto"
      base.aspectRatio = "1 / 1"
    } else {
      base.width = "100%"
      base.height = "100%"
    }
  }

  return Object.entries(base)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")
})

// Inner aspect box (only when using reserved bars)
const mediaAspectBoxStyle = computed(() => {
  if (!useReservedBars.value) return ""
  const base: Record<string, string> = {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  }
  if (layoutEffective.value === "grid") {
    // Grid: keep a square media box; bars add extra height above/below
    base.aspectRatio = "1 / 1"
  } else {
    // Mosaic: let the media fill the remaining space between bars exactly
    base.flex = "1 1 0%"
    base.minHeight = "0"
  }
  return Object.entries(base)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")
})

const galleryItems = ref<MediaGalleryMeta[]>([])
// Show skeletons when loading and no items yet
const showSkeletons = computed(() => {
  if ((galleryItems.value?.length || 0) > 0) return false
  if (props.skeletonLoading) return true
  if (!props.showLoading) return false
  return imageCreations.loadingCreations || videoCreations.loadingCreations
})

watch(
  () => [layoutEffective.value, cols.value, isPhone.value, props.skeletonLoading],
  () => {
    if (showSkeletons.value) reseedSkeletons()
  },
)

watch(
  () => showSkeletons.value,
  (val, oldVal) => {
    if (val && !oldVal) reseedSkeletons()
  },
)

const skeletonGridMinHeightPx = computed(() => {
  const base = gridMinSize.value
  const reserved = useReservedBars.value ? effectiveTopBarPx.value + effectiveBottomBarPx.value : 0
  return Math.max(96, Math.round(base + reserved))
})

const skeletonMosaicExtraRows = computed(() => {
  if (!useReservedBars.value) return 0
  const rowHeightPx = Math.max(1, Number(thumbSize.value) * props.rowHeightRatio)
  const reserved = effectiveTopBarPx.value + effectiveBottomBarPx.value
  if (reserved <= 0) return 0
  return Math.max(0, Math.ceil(reserved / Math.max(1, rowHeightPx)))
})

const skeletonItems = computed(() => {
  const count = SKELETON_COUNT
  const isMosaic = layoutEffective.value === "mosaic"
  const items: Array<{ id: string; style: Record<string, string> }> = []
  const rng = createSeededRandom(skeletonSeed.value || 1)
  const minHeightPx = skeletonGridMinHeightPx.value
  const extraRows = skeletonMosaicExtraRows.value

  const effectiveCols = (() => {
    if (isPhone.value) {
      return isMosaic ? 2 : 1
    }
    return Math.max(1, cols.value || 1)
  })()

  for (let i = 0; i < count; i++) {
    const style: Record<string, string> = {}
    if (isMosaic) {
      let colSpan = 1
      const rollCol = rng()
      if (rollCol > 0.8) colSpan = 3
      else if (rollCol > 0.5) colSpan = 2
      colSpan = Math.max(1, Math.min(effectiveCols, colSpan))

      let rowSpan = 1
      const rollRow = rng()
      if (rollRow > 0.85) rowSpan = 3
      else if (rollRow > 0.5) rowSpan = 2
      if (isPhone.value) rowSpan = Math.min(rowSpan, 2)

      const spanWithBars = Math.max(1, rowSpan + extraRows)
      style.gridColumn = `span ${colSpan}`
      style.gridRow = `span ${spanWithBars}`
    } else {
      style.minHeight = `${minHeightPx}px`
      style.aspectRatio = "1 / 1"
    }

    items.push({ id: `sk-${i}`, style })
  }

  return items
})
// Offscreen unloading is disabled for small galleries to avoid Safari popping
const UNLOAD_THRESHOLD = 200
const unloadingEnabled = computed(() => (galleryItems.value?.length || 0) > UNLOAD_THRESHOLD)

// Sticky placeholder support to keep loading tiles visible even if upstream removes them too early
const stickyPendingMap = ref<Record<string, MediaGalleryMeta & { addedAt: number }>>({})
const stickyOrder = ref<string[]>([])
const prevRealIds = ref<Set<string>>(new Set())
const prevPlaceholderIds = ref<Set<string>>(new Set())

// When create-image flow reports no more pending placeholders, drop any stickies
watch(
  () => (createImageStore?.state?.pendingPlaceholders as string[] | undefined)?.length || 0,
  (len) => {
    if (len === 0 && (stickyOrder.value.length || Object.keys(stickyPendingMap.value).length)) {
      stickyPendingMap.value = {}
      stickyOrder.value = []
      void buildItems(props.mediaObjects)
    }
  },
)

const filteredGalleryItems = computed(() => {
  const list = Array.isArray(galleryItems.value) ? galleryItems.value : []
  // Filter out any undefined/null or items without id to keep template safe
  return list.filter((el) => !!el && (typeof (el as any).id === "string" || typeof (el as any).id === "number"))
})

function pruneInactiveState(activeIds: Set<string>) {
  const pruneRecord = (record: Record<string, unknown>) => {
    for (const key of Object.keys(record)) {
      if (!activeIds.has(key)) {
        delete record[key]
      }
    }
  }

  pruneRecord(videoLoading.value)
  pruneRecord(videoReloadKey.value)
  pruneRecord(imageLoading.value)
  pruneRecord(imageReloadKey.value)
  pruneRecord(imageTargetSize.value)
  pruneRecord(imageCurrentSize.value)
  pruneRecord(imageUpgradeQueue.value as Record<string, unknown>)
  pruneRecord(imageUpgradeAttempts.value as Record<string, unknown>)
  pruneRecord(imageUpgradeInFlight.value as Record<string, unknown>)
  pruneRecord(layoutSpans.value as Record<string, unknown>)
  pruneRecord(visibleMap.value)
  pruneRecord(nearVisibleMap.value)
  pruneRecord(privacyLoading.value)
  pruneRecord(deleteLoading.value)
  pruneRecord(addInputLoading.value)
  pruneRecord(videoSources.value as Record<string, unknown>)

  for (const key of Array.from(videoRetryState.keys())) {
    if (!activeIds.has(key)) {
      clearVideoRetryState(key)
    }
  }
  for (const key of Array.from(videoPlaybackState.keys())) {
    if (!activeIds.has(key)) {
      clearVideoPlaybackState(key)
    }
  }

  for (const [key, burst] of Object.entries(upvoteBursts.value)) {
    if (!activeIds.has(key)) {
      if (burst?.timer) window.clearTimeout(burst.timer)
      delete upvoteBursts.value[key]
    }
  }
}

// Note: We intentionally avoid any TransitionGroup move animations for the
// gallery to keep item updates snappy and avoid re-order jank.

// Cache per-item layout spans so size stays stable across load/unload
// This prevents grid jumpiness when media mounts/unmounts or updates its ratio
const layoutSpans = ref<Record<string, { colSpan?: number; rowSpan: number }>>({})

// Reset cached spans when layout-affecting inputs change
watch(
  () => [cols.value, props.rowHeightRatio, layoutEffective.value, thumbSize.value, props.centerAlign],
  () => {
    layoutSpans.value = {}
  },
)

// When switching between small/large screens, the reserved-bars mode may flip.
// Reset cached spans so mosaic recalculates row spans with/without bar rows.
watch(
  () => useReservedBars.value,
  () => {
    layoutSpans.value = {}
    void buildItems(props.mediaObjects)
  },
)

watch(
  () => props.mediaObjects,
  (val) => {
    void buildItems(val)
  },
  { immediate: true, deep: true },
)

watch(
  () => [props.layout, isPhone.value],
  () => {
    void buildItems(props.mediaObjects)
  },
)

async function buildItems(src: MediaGalleryMeta[] | undefined | null) {
  if (!Array.isArray(src)) {
    galleryItems.value = []
    prevRealIds.value = new Set()
    prevPlaceholderIds.value = new Set()
    pruneInactiveState(new Set())
    return
  }
  // IMPORTANT: avoid preloading image/video metadata for offscreen items to keep memory low.
  // We only compute aspect ratio from existing data; otherwise fall back to 1 until media loads.
  const normalized = src
    .filter((item): item is MediaGalleryMeta => !!item && (typeof (item as any).id === "string" || typeof (item as any).id === "number"))
    .map((item) => {
      const incomingType = ((item.mediaType ?? item.type) as string | undefined)?.toString().toLowerCase()
      const mediaId = String(item.id)
      if (!item.url) {
        item.url = incomingType === "video" ? s3Video(mediaId, "preview-md") : img(mediaId, previewInitialSize)
      }
      const derived = (incomingType as "image" | "video" | undefined) ?? getMediaType(item.url)
      const type: "image" | "video" = derived === "video" ? "video" : "image"
      const isPlaceholder = item.placeholder === true || (typeof item.id === "string" && item.id.startsWith("pending-"))
      if (type === "image") {
        const existingSize = imageCurrentSize.value[mediaId]
        const providedSize = extractSizeFromUrl(item.url || "")
        let initialSize: ImageSize
        if (existingSize) {
          initialSize = existingSize
        } else if (providedSize) {
          initialSize = getSizeRank(providedSize) > getSizeRank(previewUpgradeTarget) ? previewInitialSize : providedSize
        } else {
          initialSize = previewInitialSize
        }
        const currentUrlSize = providedSize
        if (!currentUrlSize || currentUrlSize !== initialSize) {
          item.url = img(mediaId, initialSize)
        }
        if (!isPlaceholder) {
          initImageProgressState(mediaId, item.url, previewUpgradeTarget)
        }
      } else if (type === "video") {
        queueVideoSrc(mediaId)
      }
      const fallbackAspect = type === "video" ? 16 / 9 : 1
      const cachedAspect = getCachedAspectRatio(item.id)
      const baseAspect = typeof item.aspectRatio === "number" ? item.aspectRatio : cachedAspect
      if (!isPlaceholder && typeof baseAspect === "number" && baseAspect > 0) {
        rememberAspectRatio(item.id, baseAspect)
      }
      const aspectRatio = layoutEffective.value === "grid" ? 1 : isPlaceholder ? 1.6 : (baseAspect ?? fallbackAspect)
      return { ...item, type, aspectRatio }
    })

  // Helper predicates
  const isPlaceholderId = (id: string | undefined) => typeof id === "string" && id.startsWith("pending-")
  const isPlaceholderItem = (it: MediaGalleryMeta) => it.placeholder === true || isPlaceholderId(it.id as any)

  // Current placeholder and real id sets
  const placeholderIdsNow = new Set(normalized.filter((i) => isPlaceholderItem(i)).map((i) => i.id))
  const realIdsNow = new Set(normalized.filter((i) => !isPlaceholderItem(i) && i.type !== "video").map((i) => i.id))

  // Detect placeholders that disappeared upstream (likely because the store removed them early)
  const disappeared = Array.from(prevPlaceholderIds.value).filter((id) => !placeholderIdsNow.has(id))
  const now = Date.now()
  // Only recreate stickies while image creation flow still has pending placeholders.
  // If the create flow has completed (success or error), do not keep orphan loading cards.
  const allowStickies = ((createImageStore?.state?.pendingPlaceholders as string[] | undefined)?.length || 0) > 0
  if (allowStickies) {
    for (const id of disappeared) {
      if (!stickyPendingMap.value[id]) {
        // Recreate a minimal placeholder tile so the user sees continued loading feedback
        stickyPendingMap.value[id] = {
          id,
          url: img(String(id), previewInitialSize),
          type: "image",
          placeholder: true,
          aspectRatio: layoutEffective.value === "grid" ? 1 : 1.6,
          addedAt: now,
        } as any
        stickyOrder.value.push(id)
      }
    }
  }

  // Count newly-arrived real images since last render to release stickies 1:1
  let newlyArrived = 0
  for (const id of realIdsNow) {
    if (!prevRealIds.value.has(id)) newlyArrived++
  }

  // Drop that many sticky placeholders (FIFO)
  while (newlyArrived > 0 && stickyOrder.value.length) {
    const dropId = stickyOrder.value.shift()!
    delete stickyPendingMap.value[dropId]
    newlyArrived--
  }

  // Build final list: include sticky placeholders only if not already provided upstream
  const upstreamIds = new Set(normalized.map((i) => i.id))
  const stickyList = stickyOrder.value
    .filter((id) => !upstreamIds.has(id))
    .map((id) => stickyPendingMap.value[id])
    .filter(Boolean) as MediaGalleryMeta[]

  const combined = [...stickyList, ...normalized]
  galleryItems.value = combined

  pruneInactiveState(new Set(combined.map((item) => item.id)))

  // Update snapshots for next build
  prevRealIds.value = realIdsNow
  prevPlaceholderIds.value = placeholderIdsNow

  if (props.showPopularity) {
    const items = galleryItems.value.map((i) => ({
      id: i.id,
      mediaType: i.type === "video" ? "video" : ("image" as MediaType),
    }))
    // Load from cache/network for anything missing; store dedupes requests
    void popularity.fetchBatchByItems(items)
  }
}

function getMediaType(url: string): "image" | "video" {
  return url.match(/\.(mp4|webm|ogg)(\?.*)?$/i) ? "video" : "image"
}

// We no longer pre-measure assets offscreen; ratios are updated opportunistically on load

function markVideoLoadStart(id: string) {
  videoLoading.value[id] = true
  cancelVideoRetryTimer(id)
  clearVideoPlaybackState(id)
}

function markVideoLoaded(id: string) {
  const el = document.querySelector(`video[data-id="${id}"]`) as HTMLVideoElement | null
  if (!el) return

  // Only mark as loaded if we have metadata and some readiness
  if (el.readyState >= 2) {
    // Use explicit false to indicate "done loading" so template checks can
    // reliably hide the overlay and show the video element.
    videoLoading.value[id] = false
    clearVideoRetryState(id)
    ensureVideoLooping(id)

    if (el.videoWidth && el.videoHeight) {
      const realAspect = el.videoWidth / el.videoHeight
      const item = galleryItems.value.find((i) => i.id === id)
      if (item) {
        const prev = item.aspectRatio
        // If aspect changed meaningfully, drop cached grid spans so the tile
        // can grow/shrink to the correct height (important for tall media in
        // mobile mosaic with reserved padding/bars).
        if (Math.abs((prev ?? 0) - realAspect) > 0.005) {
          delete layoutSpans.value[id]
        }
        item.aspectRatio = realAspect
        rememberAspectRatio(id, realAspect)
      }
    }
  }
}

function markVideoErrored(id: string) {
  // Keep showing the loading overlay while we retry fetching the preview
  videoLoading.value[id] = true
  clearVideoPlaybackState(id)
  scheduleVideoRetry(id)
}

function markImageLoaded(id: string) {
  imageLoading.value[id] = false
  const im = document.querySelector(`img[data-id="${id}"]`) as HTMLImageElement | null
  if (im && im.naturalWidth && im.naturalHeight) {
    const realAspect = im.naturalWidth / im.naturalHeight
    const item = galleryItems.value.find((i) => i.id === id)
      if (item) {
        const prev = item.aspectRatio
        // Clear cached mosaic row/col spans when the real aspect arrives so the
        // grid can reflow and reveal the full image height on mobile.
        if (Math.abs((prev ?? 0) - realAspect) > 0.005) {
          delete layoutSpans.value[id]
        }
        item.aspectRatio = realAspect
        rememberAspectRatio(id, realAspect)
      }
    }
  }

function markImageErrored(id: string) {
  const item = galleryItems.value.find((i) => i.id === id)
  if (!item) return
  // Determine current and target sizes
  const curUrl = item.url || ""
  const curSize = imageCurrentSize.value[id] || extractSizeFromUrl(curUrl) || previewInitialSize
  const target = imageTargetSize.value[id] || previewUpgradeTarget
  // If current attempted size failed and it's larger than sm, fallback to sm immediately
  if (getSizeRank(curSize) > getSizeRank(previewInitialSize)) {
    // Initialize upgrade plan if not set
    const queue = imageUpgradeQueue.value[id] ?? []
    if (!queue.includes(target)) {
      imageUpgradeQueue.value[id] = [...queue.filter((size) => size !== target), target]
      imageUpgradeAttempts.value[id] = {}
    }
    imageTargetSize.value[id] = target
    // Switch to small for instant feedback
    const nextUrl = img(String(id), previewInitialSize) + cacheBust()
    item.url = nextUrl
    imageCurrentSize.value[id] = previewInitialSize
    // Show loading overlay until sm finishes the very first time
    imageLoading.value[id] = true
    // Ensure upgrade loop is running
    ensureImageUpgradeTimer()
  } else {
    // Already at smallest; stop the spinner to avoid a stuck loading card
    imageLoading.value[id] = false
  }
}

function canTogglePrivacy(item: MediaGalleryMeta): boolean {
  return props.showVisibilityToggle && !!item.requestId && item.placeholder !== true
}

function canDelete(item: MediaGalleryMeta): boolean {
  return !!props.showDeleteButton && item.placeholder !== true
}

function updateStoreRequestPublic(requestId: string, requestType: "image" | "video", value: boolean) {
  const stores = requestType === "image" ? [imageCreations] : [videoCreations]
  for (const store of stores) {
    const creation = store.creations.find((c) => c.id === requestId)
    if (creation) creation.public = value
  }
}

function updateLocalItemsPublic(requestId: string, value: boolean) {
  for (const item of galleryItems.value) {
    if (item.requestId === requestId) item.isPublic = value
  }
}

function handleVisibilityClick(item: MediaGalleryMeta) {
  if (!canTogglePrivacy(item) || !item.requestId) return
  const currentPublic = item.isPublic !== false
  const nextPublic = !currentPublic
  const requestType = (item.requestType || item.type || "image") as "image" | "video"
  const requestId = item.requestId
  const { surcharge, taxPercent } = estimatePrivateTax(requestId, requestType, item)
  // Build context-rich message for image privacy changes, including
  // unlock pricing and creator earnings from pricesStore.
  let message: string
  if (nextPublic) {
    if (requestType === "image") {
      const unlockCost = (prices?.image?.unlock as number) ?? 0
      const earn = (prices?.image?.unlockCommission as number) ?? 0
      message = `Make this creation public? It will appear in the community feed. Others can unlock the prompt details and the full‑resolution/upscaled image for ${unlockCost} points. You earn ${earn} points each time someone unlocks it.`
    } else {
      // Default/generic copy (videos)
      message = "Make this creation public? It will appear in the community feed."
    }
  } else {
    // Going private: preserve existing surcharge/tax explanation, then append context for images
    const base = taxPercent > 0 ? (surcharge > 0 ? `Make this creation private? This costs ${surcharge} points (${taxPercent}% of the original price).` : `Make this creation private? This adds a ${taxPercent}% surcharge.`) : "Make this creation private?"
    if (requestType === "image") {
      message = `${base} Private creations are hidden from the community feed and can’t be unlocked. Others won’t see your prompt details or the full‑resolution image.`
    } else {
      message = base
    }
  }

  Dialog.create({
    title: nextPublic ? "Share creation publicly?" : "Make creation private?",
    message,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      privacyLoading.value[requestId] = true
      await creationsSetRequestPrivacy({
        public: nextPublic,
        imageRequestId: requestType === "image" ? requestId : undefined,
        videoRequestId: requestType === "video" ? requestId : undefined,
      })
      updateStoreRequestPublic(requestId, requestType, nextPublic)
      updateLocalItemsPublic(requestId, nextPublic)
      item.isPublic = nextPublic
      $q.notify({
        type: "positive",
        message: nextPublic ? "Creation is now public." : "Creation set to private.",
      })
    } catch (err) {
      console.error("Failed to toggle privacy", err)
      $q.notify({ type: "negative", message: "Unable to update visibility. Please try again." })
    } finally {
      privacyLoading.value[requestId] = false
    }
  })
}

function estimatePrivateTax(requestId: string, requestType: "image" | "video", item: MediaGalleryMeta) {
  const rate = privateTaxRate.value
  const percent = privateTaxPercent.value
  if (rate <= 0) return { surcharge: 0, taxPercent: percent }

  const creationStore = requestType === "image" ? imageCreations : videoCreations
  const creation = creationStore.creations.find((c) => c.id === requestId)

  const quantity = creation?.quantity ?? item.requestQuantity ?? 1

  let baseCost = 0

  if (requestType === "image") {
    const modelKey = creation?.model as keyof typeof prices.image.model | undefined
    const modelPrice = (modelKey && prices.image?.model?.[modelKey] != null ? prices.image.model[modelKey] : undefined) ?? 0
    const surcharge = creation?.model === "custom" ? (prices.forge?.customModelCharge ?? 0) : 0
    baseCost = (modelPrice + surcharge) * quantity
  } else {
    const modelKey = creation?.model as keyof typeof prices.video.model | undefined
    const perSecond = (modelKey && prices.video?.model?.[modelKey] != null ? prices.video.model[modelKey] : undefined) ?? 0
    const duration = creation?.duration ?? 1
    baseCost = perSecond * duration * quantity
  }

  const surcharge = Math.ceil(baseCost * rate)
  return { surcharge, taxPercent: percent }
}

function handleDeleteClick(item: MediaGalleryMeta) {
  Dialog.create({
    title: "Delete Creation",
    message: "Are you sure you want to delete this creation?",
    ok: { label: "Delete", color: "negative" },
    cancel: { label: "Cancel", color: "primary" },
    persistent: true,
  }).onOk(async () => {
    try {
      deleteLoading.value[item.id] = true
      await creationsDeleteMedia(item.type === "video" ? { videoId: item.id } : { imageId: item.id })

      // Remove from local gallery
      galleryItems.value = galleryItems.value.filter((i) => i.id !== item.id)

      // Update stores so other views stay in sync
      if (item.type === "image") {
        const creation = imageCreations.creations.find((c) => c.mediaIds.includes(item.id))
        if (creation) imageCreations.deleteImage(item.id, creation.id)
      } else {
        const creation = videoCreations.creations.find((c) => c.mediaIds.includes(item.id))
        if (creation) videoCreations.deleteVideo(item.id, creation.id)
      }

      $q.notify({ type: "positive", message: "Deleted" })
    } catch (err) {
      console.error("Failed to delete media", err)
      $q.notify({ type: "negative", message: "Unable to delete. Please try again." })
    } finally {
      delete deleteLoading.value[item.id]
    }
  })
}

function getItemStyle(m: MediaGalleryMeta): Record<string, string | number | undefined> {
  if (layoutEffective.value !== "mosaic") {
    // In grid mode, enforce a minimum height so the cell never collapses
    return layoutEffective.value === "grid" ? { minHeight: `${gridMinSize.value}px` } : {}
  }

  const cached = layoutSpans.value[m.id]
  if (cached) {
    return {
      gridRowEnd: `span ${cached.rowSpan}`,
      gridColumnEnd: cached.colSpan ? `span ${cached.colSpan}` : undefined,
    }
  }

  // Compute once per id and cache to avoid reflow as media loads/unloads
  const aspect = m.aspectRatio ?? 1
  const baseColSpan = aspect > 1.5 && cols.value > 1 ? Math.min(2, cols.value) : undefined
  const colFactor = baseColSpan ?? 1

  // Calculate the mosaic tile width in px using the measured column width and
  // add internal gap(s) when the item spans multiple columns.
  const colWidth = mosaicColWidthPx.value || Number(thumbSize.value) || 0
  const internalGaps = Math.max(0, colFactor - 1) * gapPx.value
  const tileWidthPx = Math.max(0.01, colWidth * colFactor + internalGaps)

  // Row size in px (as set on the grid container)
  const gridAutoRowPx = Math.max(1, Number(thumbSize.value) * props.rowHeightRatio)

  // Rows needed for the media area itself based on its aspect
  const mediaHeightPx = tileWidthPx / Math.max(0.01, aspect)
  let rows = Math.max(1, Math.ceil(mediaHeightPx / gridAutoRowPx))

  // When reserved bars are enabled, add extra rows to account for their height so
  // the item never overlaps neighbors.
  if (useReservedBars.value) {
    const extra = Math.ceil((effectiveTopBarPx.value + effectiveBottomBarPx.value) / Math.max(1, gridAutoRowPx))
    rows += extra
  }

  const entry = { colSpan: baseColSpan, rowSpan: rows }
  layoutSpans.value[m.id] = entry

  return {
    gridRowEnd: `span ${entry.rowSpan}`,
    gridColumnEnd: entry.colSpan ? `span ${entry.colSpan}` : undefined,
  }
}

/**
 * Popularity polling and video reload retry setup
 */

// Compose items payload for popularity store
function getPopularityItems(): { id: string; mediaType: "image" | "video" }[] {
  return galleryItems.value.map((i) => ({
    id: i.id,
    mediaType: i.type === "video" ? "video" : ("image" as MediaType),
  }))
}

// Track previous set of IDs to trigger an immediate refresh for new items
const prevIdSet = ref<Set<string>>(new Set())

function startPopularityPolling() {
  stopPopularityPolling()
  const run = async () => {
    if (!props.showPopularity) return
    if (typeof document !== "undefined" && document.hidden) {
      popularityPollTimer = window.setTimeout(run, pollIntervalMs) as unknown as number
      return
    }
    const items = getPopularityItems()
    if (items.length === 0) {
      popularityPollTimer = window.setTimeout(run, pollIntervalMs) as unknown as number
      return
    }
    try {
      // Only refresh missing/stale entries to limit network and avoid overlap
      await popularity.refreshStaleByItems(items, { ttlMs: 120000, max: 200 })
    } finally {
      popularityPollTimer = window.setTimeout(run, pollIntervalMs) as unknown as number
    }
  }
  void run()
}

function stopPopularityPolling() {
  if (popularityPollTimer) {
    window.clearTimeout(popularityPollTimer)
    popularityPollTimer = null
  }
}

// Start/stop polling based on prop
watch(
  () => props.showPopularity,
  (enabled) => {
    if (enabled) startPopularityPolling()
    else stopPopularityPolling()
  },
  { immediate: true },
)

// Refresh per-user fields when auth state changes
watch(
  () => userAuth.loggedIn,
  () => {
    if (props.showPopularity) void popularity.refreshBatchByItems(getPopularityItems())
  },
)

// When gallery content changes, ensure any missing popularity entries are fetched
watch(
  () => galleryItems.value.map((i) => i.id).join(","),
  () => {
    if (!props.showPopularity) return
    // Always request popularity for any missing entries (fast cache path)
    void popularity.fetchBatchByItems(getPopularityItems())

    // Additionally, force a fresh server refresh for only newly-appearing items
    const currentIds = galleryItems.value.map((i) => i.id)
    const newIds = currentIds.filter((id) => !prevIdSet.value.has(id))
    if (newIds.length) {
      const newItems = galleryItems.value.filter((i) => newIds.includes(i.id)).map((i) => ({ id: i.id, mediaType: i.type === "video" ? "video" : ("image" as MediaType) }))
      void popularity.refreshBatchByItems(newItems)
    }
    // Update the snapshot of IDs
    prevIdSet.value = new Set(currentIds)
  },
)

onMounted(() => {
  // Move retry loop to lifecycle and clean up on unmount
  videoReloadTimer = window.setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return
    // Retry videos that aren't ready yet
    for (const id of Object.keys(videoLoading.value)) {
      if (videoLoading.value[id]) {
        // Only nudge reload for visible videos (or all when unloading disabled)
        if (isVisible(id)) videoReloadKey.value[id] = Date.now()
      }
    }
    // Retry images only when the loading UI is enabled
    if (props.showLoading) {
      for (const id of Object.keys(imageLoading.value)) {
        if (imageLoading.value[id]) {
          if (isVisible(id)) imageReloadKey.value[id] = Date.now()
        }
      }
    }
  }, 10000) as unknown as number
  ensureImageUpgradeTimer()
})

onUnmounted(() => {
  if (videoReloadTimer !== null) {
    window.clearInterval(videoReloadTimer)
    videoReloadTimer = null
  }
  stopPopularityPolling()
  if (imageUpgradeTimer !== null) {
    window.clearInterval(imageUpgradeTimer)
    imageUpgradeTimer = null
  }
  for (const key of Array.from(videoRetryState.keys())) {
    clearVideoRetryState(key)
  }
  for (const key of Array.from(videoPlaybackState.keys())) {
    clearVideoPlaybackState(key)
  }
})

function isVideoMedia(m?: MediaGalleryMeta): boolean {
  if (!m) return false
  const url = m.url || ""
  const t = m.type ?? getMediaType(url)
  return t === "video"
}

// Near-viewport helper for soft culling logic
function isNear(id: string): boolean {
  if (!unloadingEnabled.value) return true
  return !!nearVisibleMap.value[id]
}

// Apply content-visibility only for far items in large galleries
function shouldCull(id: string): boolean {
  return unloadingEnabled.value && !isNear(id)
}

function videoClass(media: MediaGalleryMeta) {
  return {
    "cursor-pointer": props.selectable && videoLoading.value[media.id] === false,
  }
}

function isVisible(id: string): boolean {
  // Disable offscreen unloading for small galleries
  if (!unloadingEnabled.value) return true
  return !!visibleMap.value[id]
}

function showImageOverlay(id: string): boolean {
  // Always cover placeholder tiles so users see progress, even if loading UI is disabled elsewhere
  const item = galleryItems.value.find((i) => i.id === id)
  const isPending = (typeof id === "string" && id.startsWith("pending-")) || item?.placeholder === true
  if (isPending) return true

  if (!props.showLoading) return false

  // treat undefined as loading=true so overlay shows until first load
  return imageLoading.value[id] !== false
}

function showVideoOverlay(id: string): boolean {
  const item = galleryItems.value.find((i) => i.id === id)
  const isPending = (typeof id === "string" && id.startsWith("pending-")) || item?.placeholder === true
  if (isPending) return true

  const state = videoLoading.value[id]
  if (!props.showLoading) return state === true || state === undefined

  return state !== false
}

// ----- Creator helpers (browse page) -----
function showCreatorFor(m: MediaGalleryMeta): boolean {
  try {
    if (!props.showCreator) return false
    if (!m?.creatorId || !m?.creatorUsername) return false
    if (shouldMaskNsfw(m)) return false
    return isVisible(m.id)
  } catch {
    return false
  }
}

function goToCreator(m: MediaGalleryMeta) {
  try {
    if (!m?.creatorUsername) return
    void router.push({ name: "profile", params: { username: m.creatorUsername } })
  } catch {}
}
// ----- Model chip helpers -----
type ModelChipMeta = {
  label: string
  model: string
  customModelId?: string | null
  customModelName?: string | null
  mediaType: "image" | "video"
}

function resolveMediaCreation(m: MediaGalleryMeta): { creation: any; mediaType: "image" | "video" } | null {
  if (!m?.id) return null

  const mediaType = (m.type ?? m.mediaType ?? (isVideoMedia(m) ? "video" : "image")) as "image" | "video"
  const store: any = mediaType === "video" ? videoCreations : imageCreations

  if (m.requestId) {
    const byRequest = store.creations.find((c: any) => c.id === m.requestId)
    if (byRequest) return { creation: byRequest, mediaType }
  }

  const byMediaId = store.creations.find((c: any) => Array.isArray(c.mediaIds) && c.mediaIds.includes(m.id))
  if (byMediaId) return { creation: byMediaId, mediaType }

  try {
    const entries: any[] = (mediaType === "video" ? videoCreations.allCreations : imageCreations.allCreations) || []
    const link = entries.find((entry: any) => entry.id === m.id)
    if (link?.creationId) {
      const viaCreationId = store.creations.find((c: any) => c.id === link.creationId)
      if (viaCreationId) return { creation: viaCreationId, mediaType }
    }
  } catch {}

  return null
}

function getModelMeta(m: MediaGalleryMeta): ModelChipMeta | null {
  try {
    const resolved = resolveMediaCreation(m)
    if (!resolved) return null
    const { creation, mediaType } = resolved

    const model = creation?.model as string | undefined
    if (!model) return null

    const customModelId = (creation?.customModelId as string | undefined) ?? null
    const customModelName = (creation?.customModelName as string | undefined) ?? null

    if (model === "custom") {
      const name = customModelName && customModelName.trim().length > 0 ? customModelName : "custom"
      const label = name && name.toLowerCase() !== "custom" ? `custom: ${name}` : "custom"
      return { label, model, customModelId, customModelName, mediaType }
    }

    return { label: model, model, customModelId, customModelName, mediaType }
  } catch {
    return null
  }
}

function getModelLabel(m: MediaGalleryMeta): string | null {
  const meta = getModelMeta(m)
  return meta?.label ?? null
}

function onModelChipClick(m: MediaGalleryMeta) {
  if (!props.enableModelChipSelect) return
  const meta = getModelMeta(m)
  if (!meta) return
  emit("modelSelect", { model: meta.model, customModelId: meta.customModelId, customModelName: meta.customModelName, mediaId: m.id, mediaType: meta.mediaType })
}

// -------- Progressive image helpers --------
function extractSizeFromUrl(url: string): ImageSize | null {
  try {
    const m = url.match(/-(xs|sm|md|lg|xl)\.webp(\?.*)?$/i)
    return (m?.[1] as ImageSize) || null
  } catch {
    return null
  }
}

function initImageProgressState(id: string, url: string, target?: ImageSize) {
  const sizeFromUrl = extractSizeFromUrl(url) || previewInitialSize
  if (!imageCurrentSize.value[id]) {
    imageCurrentSize.value[id] = sizeFromUrl
  }
  const currentSize = imageCurrentSize.value[id] ?? sizeFromUrl

  if (!target) {
    if (!imageTargetSize.value[id]) imageTargetSize.value[id] = currentSize
    return
  }

  const currentRank = getSizeRank(currentSize)
  const targetRank = getSizeRank(target)

  if (currentRank >= targetRank) {
    imageTargetSize.value[id] = currentSize
    return
  }

  imageTargetSize.value[id] = target
  const queue = imageUpgradeQueue.value[id] ?? []
  if (!queue.includes(target)) {
    imageUpgradeQueue.value[id] = [...queue.filter((size) => size !== target), target]
    imageUpgradeAttempts.value[id] = {}
  }
  ensureImageUpgradeTimer()
}

function ensureImageUpgradeTimer() {
  if (imageUpgradeTimer !== null) return
  imageUpgradeTimer = window.setInterval(runImageUpgradeTick, UPGRADE_INTERVAL_MS) as unknown as number
}

function runImageUpgradeTick() {
  try {
    if (typeof document !== "undefined" && document.hidden) return
    const now = Date.now()
    let shouldKeepAlive = false
    for (const item of galleryItems.value) {
      if (item.type !== "image") continue
      const id = item.id
      const queue = imageUpgradeQueue.value[id]
      if (!queue || queue.length === 0) continue
      shouldKeepAlive = true
      if (!isVisible(id)) continue
      if (imageUpgradeInFlight.value[id]) continue
      const nextSize = queue[0] as ImageSize
      const attempts = (imageUpgradeAttempts.value[id]?.[nextSize] || 0) as number
      if (attempts >= MAX_ATTEMPTS_PER_SIZE) {
        // Give up on this size and move to the next
        queue.shift()
        continue
      }
      // Prefetch the next size; use a cache-buster to avoid CDN 404 caching
      const testUrl = img(String(id), nextSize) + cacheBust(now)
      imageUpgradeInFlight.value[id] = true
      prefetchImage(testUrl)
        .then(() => {
          // Swap in the higher resolution
          item.url = img(String(id), nextSize) + cacheBust(now)
          imageCurrentSize.value[id] = nextSize
          // Move to the next step in the queue
          queue.shift()
        })
        .catch(() => {
          // Increment attempts and try again on a future tick
          const cur = imageUpgradeAttempts.value[id] || {}
          cur[nextSize] = (cur[nextSize] || 0) + 1
          imageUpgradeAttempts.value[id] = cur
        })
        .finally(() => {
          imageUpgradeInFlight.value[id] = false
        })
    }
    if (!shouldKeepAlive && imageUpgradeTimer !== null) {
      window.clearInterval(imageUpgradeTimer)
      imageUpgradeTimer = null
    }
  } catch (e) {
    // best-effort; never throw
    console.warn("image upgrade tick error", e)
  }
}

function cacheBust(ts?: number) {
  const t = ts ?? Date.now()
  return `?cb=${t}`
}

function prefetchImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    const clean = () => {
      i.onload = null
      i.onerror = null
    }
    i.onload = () => {
      clean()
      resolve()
    }
    i.onerror = () => {
      clean()
      reject(new Error("prefetch-failed"))
    }
    i.src = url
  })
}
</script>

<template lang="pug">
.full-width
  // Pinch zoom overlay (mobile only). Displays while pinching a tile
  div.pinch-zoom-overlay(v-if="pinchActiveId && pinchStartRect")
    img.pinch-zoom-img(
      :src="pinchImageUrl"
      :style="pinchImageStyle"
    )
  // Initial skeleton shimmer when loading with no items
  div(v-if="showSkeletons" :style="wrapperStyles" class="mg-grid" ref="gridRef")
    div(v-for="sk in skeletonItems" :key="sk.id" class="mg-skel-cell" :style="sk.style")
      q-skeleton(type="rect" animation="wave" class="mg-skel-box")

  div.mg-group(
    v-else
    :style="wrapperStyles"
    ref="gridRef"
  )
    div(
      v-for="(m, index) in filteredGalleryItems"
      :key="m.id"
      :style="getItemStyle(m)"
      :class="{ 'media-cell': true, 'is-selected': props.selectable && selectedSet.has(m.id) }"
      v-observe="m.id"
      v-observe-near="m.id"
    )
      template(v-if="!isVideoMedia(m)")
        .media-wrapper(:style="mediaWrapperStyle" :class="{ 'mode-grid': layoutEffective === 'grid', 'mode-mosaic': layoutEffective === 'mosaic', 'is-cull': shouldCull(m.id) }")
          // Reserved top/bottom bars path
          template(v-if="useReservedBars")
            // Top bar (reserved space)
            .mg-topbar(
              v-if="effectiveTopBarPx > 0"
              :style="{ minHeight: effectiveTopBarPx + 'px', '--mg-bar-bg': `url('${barBgUrlFor(m)}')` }"
              :class="{ 'with-creator': showCreatorFor(m) }"
            )
              template(v-if="isVisible(m.id) && !shouldMaskNsfw(m)")
                // Creator avatar + username (left)
                .creator-meta(v-if="showCreatorFor(m)" @click.stop="goToCreator(m)")
                  q-img(:src="avatarImg(m.creatorId || '')" style="width:18px; height:18px; border-radius:50%;")
                  .creator-name(:title="'@' + (m.creatorUsername || '')") @{{ m.creatorUsername }}
                // Actions (right)
                div.bar-actions(style="display:flex; align-items:center; gap:10px;")
                  q-btn(v-if="canDelete(m)" :size="popIconSize" flat dense round color="white" icon="delete" @click.stop="handleDeleteClick(m)" :loading="!!deleteLoading[m.id]" :disable="deleteLoading[m.id] === true")
                  q-btn(v-if="props.showUseAsInput && !m.placeholder" :size="popIconSize" flat dense round color="white" icon="add_photo_alternate" @click.stop="addAsInput(m.id)" :loading="!!addInputLoading[m.id]" :disable="addInputLoading[m.id] === true")
                  q-btn(v-if="canTogglePrivacy(m)" :size="popIconSize" flat dense round color="white" :icon="m.isPublic ? 'public' : 'visibility_off'" @click.stop="handleVisibilityClick(m)" :loading="!!privacyLoading[m.requestId || '']" :disable="privacyLoading[m.requestId || ''] === true")
                    q-tooltip {{ m.isPublic ? 'Currently public. Click to make private.' : 'Currently private. Click to make public.' }}
            // Media area
            .media-aspect(:style="[mediaAspectBoxStyle, { '--mg-media-bg': `url('${barBgUrlFor(m)}')` }]")
              // Only mount heavy content when visible
              template(v-if="isVisible(m.id)")
                template(v-if="shouldMaskNsfw(m)")
                  div.nsfw-overlay(@click.stop="handleSelect(m, index)")
                    q-icon(name="sym_o_visibility_off" size="36px")
                    span.nsfw-label NSFW Content
                    span.nsfw-helper Tap to confirm viewing
                template(v-else)
                  // Loading overlay for images that are still rendering/propagating
                  // Use v-show to avoid DOM remove/add and prevent pop
                  div.loading-overlay(v-show="!isPendingItem(m) && showImageOverlay(m.id)")
                    div.loading-overlay__stack
                      q-spinner-gears(color="grey-10" size="clamp(64px, 60%, 120px)" class="loading-overlay__spinner")
                      span.loading-overlay__label Loading
                  // Actual image (rendered underneath the overlay)
                  template(v-if="!isPendingItem(m)")
                    q-img(
                      :src="m.url"
                      :key="imageReloadKey[m.id]"
                      position="top"
                      style="width:100%; height:100%; object-fit: cover; object-position: top; display:block;"
                      transition="none"
                      no-transition
                      no-spinner
                      :img-style="{ transition: 'none' }"
                      :class="props.selectable ? 'cursor-pointer' : ''"
                      :img-attrs="{ 'data-id': m.id }"
                      @load="markImageLoaded(m.id)"
                      @error="markImageErrored(m.id)"
                      @click="onImageClick(m, index)"
                      @touchstart="onPinchStart($event, m)"
                      @touchmove="onPinchMove"
                      @touchend="onPinchEnd"
                      @touchcancel="onPinchEnd"
                    )
                  // Pending items: avoid mounting <img> to prevent UA broken-icon flicker
                  template(v-else)
                    div.media-placeholder(:class="{ 'media-placeholder--pending': props.showLoading }")
                      template(v-if="props.showLoading")
                        div.loading-overlay
                          div.loading-overlay__stack
                            q-spinner-gears(color="grey-10" size="clamp(64px, 60%, 120px)" class="loading-overlay__spinner")
                            span.loading-overlay__label Loading
              template(v-else)
                // Offscreen: render a lightweight black placeholder to avoid blank gaps
                div.media-placeholder
              // Hidden overlay - keeps layout stable
              .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
                .hidden-text Hidden
                q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'image')" label="Unhide")
              // Model chip
              .model-chip(
                v-if="isVisible(m.id) && !shouldMaskNsfw(m) && getModelLabel(m)"
                :class="{ 'is-clickable': props.enableModelChipSelect }"
                @click.stop="onModelChipClick(m)"
              ) {{ getModelLabel(m) }}
            // Bottom bar (reserved space)
            .mg-bottombar(
              v-if="effectiveBottomBarPx > 0"
              :style="{ minHeight: effectiveBottomBarPx + 'px', '--mg-bar-bg': `url('${barBgUrlFor(m)}')` }"
            )
              // Popularity controls
              template(v-if="props.showPopularity && !shouldMaskNsfw(m) && isVisible(m.id)")
                .pop-row(:class="{ 'has-any-counts': !!((popularity.get(m.id)?.favorites) || (popularity.get(m.id)?.commentsCount) || (popularity.get(m.id)?.upvotes)) }")
                  .pop-item
                    q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'image')")
                    span.count(:class="{ empty: !(popularity.get(m.id)?.favorites) }") {{ popularity.get(m.id)?.favorites ?? 0 }}
                  .pop-item
                    q-btn(:size="popIconSize" flat dense round icon="chat_bubble" color="white" @click.stop="openCommentsFromOverlay(m)")
                    span.count(:class="{ empty: !(popularity.get(m.id)?.commentsCount) }") {{ popularity.get(m.id)?.commentsCount ?? 0 }}
                  .pop-item
                    .upvote-burst-wrap
                      q-btn(:size="popIconSize" flat dense round :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'" @click.stop="onUpvote(m.id, 'image')")
                      transition(name="burst")
                        .upvote-burst(v-if="upvoteBursts[m.id]?.visible") | +{{ upvoteBursts[m.id]?.count || 0 }}
                    span.count(:class="{ empty: !(popularity.get(m.id)?.upvotes) }") {{ popularity.get(m.id)?.upvotes ?? 0 }}
                  .pop-item
                    q-btn(:size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'image')")
                    span.count.empty 0
            // Optional extra actions slot
            slot(name="actions" :media="m" :index="index")
          // Legacy overlay path (no reserved bars)
          template(v-else)
            // Stable inner wrapper so swapping preview/img does not trigger group transitions
            .media-fill(:style="{ '--mg-media-bg': `url('${barBgUrlFor(m)}')` }")
              // Only mount heavy content when visible
              template(v-if="isVisible(m.id)")
                template(v-if="shouldMaskNsfw(m)")
                  div.nsfw-overlay(@click.stop="handleSelect(m, index)")
                    q-icon(name="sym_o_visibility_off" size="36px")
                    span.nsfw-label NSFW Content
                    span.nsfw-helper Tap to confirm viewing
                template(v-else)
                  // Loading overlay for images that are still rendering/propagating
                  div.loading-overlay(v-show="!isPendingItem(m) && showImageOverlay(m.id)")
                    div.loading-overlay__stack
                      q-spinner-gears(color="grey-10" size="clamp(64px, 60%, 120px)" class="loading-overlay__spinner")
                      span.loading-overlay__label Loading
                  // Actual image (rendered underneath the overlay)
                  template(v-if="!isPendingItem(m)")
                    q-img(
                      :src="m.url"
                      :key="imageReloadKey[m.id]"
                      position="top"
                      style="width:100%; height:100%; object-fit: cover; object-position: top; display:block"
                      transition="none"
                      no-transition
                      no-spinner
                      :img-style="{ transition: 'none' }"
                      :class="props.selectable ? 'cursor-pointer' : ''"
                      :img-attrs="{ 'data-id': m.id }"
                      @load="markImageLoaded(m.id)"
                      @error="markImageErrored(m.id)"
                      @click="onImageClick(m, index)"
                      @touchstart="onPinchStart($event, m)"
                      @touchmove="onPinchMove"
                      @touchend="onPinchEnd"
                      @touchcancel="onPinchEnd"
                    )
                  // Pending items: avoid mounting <img> to prevent UA broken-icon flicker
                  template(v-else)
                    div.media-placeholder(:class="{ 'media-placeholder--pending': props.showLoading }")
                      template(v-if="props.showLoading")
                        div.loading-overlay
                          div.loading-overlay__stack
                            q-spinner-gears(color="grey-10" size="clamp(64px, 60%, 120px)" class="loading-overlay__spinner")
                            span.loading-overlay__label Loading
              template(v-else)
                // Offscreen: render a lightweight black placeholder to avoid blank gaps
                div.media-placeholder
            // Top actions overlay (centered; matches bottom popularity row style)
            .top-actions-overlay(
              v-if="isVisible(m.id) && !shouldMaskNsfw(m) && !showImageOverlay(m.id) && !(isPhone && layoutEffective === 'mosaic') && (canDelete(m) || canTogglePrivacy(m) || (props.showUseAsInput && !m.placeholder && (m.type === 'image' || m.mediaType === 'image')) || showCreatorFor(m))"
            )
              // Creator profile chip (avatar + @username)
              .creator-meta(v-if="showCreatorFor(m)" @click.stop="goToCreator(m)")
                q-img(:src="avatarImg(m.creatorId || '')" style="width:18px; height:18px; border-radius:50%;")
                .creator-name(:title="'@' + (m.creatorUsername || '')") @{{ m.creatorUsername }}
              // Delete
              q-btn(v-if="canDelete(m)" :size="popIconSize" flat dense round color="white" icon="delete" @click.stop="handleDeleteClick(m)" :loading="!!deleteLoading[m.id]" :disable="deleteLoading[m.id] === true")
              // Add as input (images only)
              q-btn(v-if="props.showUseAsInput && !m.placeholder && (m.type === 'image' || m.mediaType === 'image')" :size="popIconSize" flat dense round color="white" icon="add_photo_alternate" @click.stop="addAsInput(m.id)" :loading="!!addInputLoading[m.id]" :disable="addInputLoading[m.id] === true")
              // Visibility toggle
              q-btn(v-if="canTogglePrivacy(m)" :size="popIconSize" flat dense round color="white" :icon="m.isPublic ? 'public' : 'visibility_off'" @click.stop="handleVisibilityClick(m)" :loading="!!privacyLoading[m.requestId || '']" :disable="privacyLoading[m.requestId || ''] === true")
                q-tooltip {{ m.isPublic ? 'Currently public. Click to make private.' : 'Currently private. Click to make public.' }}
            .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
              .hidden-text Hidden
              q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'image')" label="Unhide")
            // Model chip (bottom-left)
            .model-chip(
              v-if="isVisible(m.id) && !shouldMaskNsfw(m) && getModelLabel(m)"
              :class="{ 'is-clickable': props.enableModelChipSelect }"
              @click.stop="onModelChipClick(m)"
            ) {{ getModelLabel(m) }}
            // Popularity overlay controls
            .popularity-overlay(:class="popularityLayoutClass(m)" v-if="props.showPopularity && !shouldMaskNsfw(m) && isVisible(m.id) && !(isPhone && layoutEffective === 'mosaic')")
              .pop-row(:class="{ 'has-any-counts': !!((popularity.get(m.id)?.favorites) || (popularity.get(m.id)?.commentsCount) || (popularity.get(m.id)?.upvotes)) }")
                .pop-item
                  q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'image')")
                  span.count(:class="{ empty: !(popularity.get(m.id)?.favorites) }") {{ popularity.get(m.id)?.favorites ?? 0 }}
                .pop-item
                  q-btn(:size="popIconSize" flat dense round icon="chat_bubble" color="white" @click.stop="openCommentsFromOverlay(m)")
                  span.count(:class="{ empty: !(popularity.get(m.id)?.commentsCount) }") {{ popularity.get(m.id)?.commentsCount ?? 0 }}
                .pop-item
                  .upvote-burst-wrap
                    q-btn(:size="popIconSize" flat dense round :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'" @click.stop="onUpvote(m.id, 'image')")
                    transition(name="burst")
                      .upvote-burst(v-if="upvoteBursts[m.id]?.visible") | +{{ upvoteBursts[m.id]?.count || 0 }}
                  span.count(:class="{ empty: !(popularity.get(m.id)?.upvotes) }") {{ popularity.get(m.id)?.upvotes ?? 0 }}
                .pop-item
                  q-btn(:size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'image')")
                  span.count.empty 0
            // Per-item actions slot (optional)
            slot(name="actions" :media="m" :index="index")
              // default empty
      template(v-else)
        .media-wrapper(:style="mediaWrapperStyle" :class="{ 'mode-grid': layoutEffective === 'grid', 'mode-mosaic': layoutEffective === 'mosaic', 'is-cull': shouldCull(m.id) }")
          // Reserved top/bottom bars path for videos
          template(v-if="useReservedBars")
            // Top bar
            .mg-topbar(
              v-if="effectiveTopBarPx > 0"
              :style="{ minHeight: effectiveTopBarPx + 'px', '--mg-bar-bg': `url('${barBgUrlFor(m)}')` }"
              :class="{ 'with-creator': showCreatorFor(m) }"
            )
              template(v-if="isVisible(m.id) && !shouldMaskNsfw(m)")
                // Creator avatar + username (left)
                .creator-meta(v-if="showCreatorFor(m)" @click.stop="goToCreator(m)")
                  q-img(:src="avatarImg(m.creatorId || '')" style="width:18px; height:18px; border-radius:50%;")
                  .creator-name(:title="'@' + (m.creatorUsername || '')") @{{ m.creatorUsername }}
                // Actions (right)
                div.bar-actions(style="display:flex; align-items:center; gap:10px;")
                  q-btn(v-if="canDelete(m)" :size="popIconSize" flat dense round color="white" icon="delete" @click.stop="handleDeleteClick(m)" :loading="!!deleteLoading[m.id]" :disable="deleteLoading[m.id] === true")
                  q-btn(v-if="canTogglePrivacy(m)" :size="popIconSize" flat dense round color="white" :icon="m.isPublic ? 'public' : 'visibility_off'" @click.stop="handleVisibilityClick(m)" :loading="!!privacyLoading[m.requestId || '']" :disable="privacyLoading[m.requestId || ''] === true")
                    q-tooltip {{ m.isPublic ? 'Currently public. Click to make private.' : 'Currently private. Click to make public.' }}
            // Media area
            .media-aspect(:style="[mediaAspectBoxStyle, { '--mg-media-bg': `url('${barBgUrlFor(m)}')` }]")
              // Only mount heavy content when visible
              template(v-if="isVisible(m.id)")
                template(v-if="shouldMaskNsfw(m)")
                  div.nsfw-overlay(@click.stop="handleSelect(m, index)")
                    q-icon(name="sym_o_visibility_off" size="36px")
                    span.nsfw-label NSFW Content
                    span.nsfw-helper Tap to confirm viewing
                template(v-else)
                  // Show spinner only after video source is attached
                  div.loading-overlay(v-show="showVideoOverlay(m.id) && hasVideoSource(m.id)")
                    div.loading-overlay__stack
                      q-spinner-gears(color="grey-10" size="clamp(64px, 60%, 120px)" class="loading-overlay__spinner")
                      span.loading-overlay__label Loading
                  div(v-if="hasVideoSource(m.id)" style="position: relative; overflow: hidden; width: 100%; height: 100%;")
                    video(
                      :src="videoSources[m.id]"
                      :key="videoReloadKey[m.id]"
                      :data-id="m.id"
                      loop autoplay muted playsinline preload="auto"
                      :poster="videoPosterFor(m.id)"
                      @loadstart="markVideoLoadStart(m.id)"
                      @canplay="markVideoLoaded(m.id)"
                      @loadeddata="markVideoLoaded(m.id)"
                      @error="markVideoErrored(m.id)"
                      @click="handleSelect(m, index)"
                      style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; background-color:#000;"
                      :class="videoClass(m)"
                    )
                  div(v-else style="position: relative; overflow: hidden; width: 100%; height: 100%;")
                    q-img(
                      :src="videoPosterFor(m.id)"
                      style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block;"
                      :class="props.selectable ? 'cursor-pointer' : ''"
                      no-spinner
                      no-transition
                      @click="handleSelect(m, index)"
                    )
              template(v-else)
                // Offscreen: render a lightweight black placeholder to avoid blank gaps
                div.media-placeholder
              // Hidden overlay - keeps layout stable
              .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
                .hidden-text Hidden
                q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'video')" label="Unhide")
              // Model chip
              .model-chip(
                v-if="isVisible(m.id) && !shouldMaskNsfw(m) && getModelLabel(m)"
                :class="{ 'is-clickable': props.enableModelChipSelect }"
                @click.stop="onModelChipClick(m)"
              ) {{ getModelLabel(m) }}
            // Bottom bar
            .mg-bottombar(
              v-if="effectiveBottomBarPx > 0"
              :style="{ minHeight: effectiveBottomBarPx + 'px', '--mg-bar-bg': `url('${barBgUrlFor(m)}')` }"
            )
              template(v-if="props.showPopularity && !shouldMaskNsfw(m) && isVisible(m.id)")
                .pop-row(:class="{ 'has-any-counts': !!((popularity.get(m.id)?.favorites) || (popularity.get(m.id)?.commentsCount) || (popularity.get(m.id)?.upvotes)) }")
                  .pop-item
                    q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'video')")
                    span.count(:class="{ empty: !(popularity.get(m.id)?.favorites) }") {{ popularity.get(m.id)?.favorites ?? 0 }}
                  .pop-item
                    q-btn(:size="popIconSize" flat dense round icon="chat_bubble" color="white" @click.stop="openCommentsFromOverlay(m)")
                    span.count(:class="{ empty: !(popularity.get(m.id)?.commentsCount) }") {{ popularity.get(m.id)?.commentsCount ?? 0 }}
                  .pop-item
                    .upvote-burst-wrap
                      q-btn(:size="popIconSize" flat dense round :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'" @click.stop="onUpvote(m.id, 'video')")
                      transition(name="burst")
                        .upvote-burst(v-if="upvoteBursts[m.id]?.visible") | +{{ upvoteBursts[m.id]?.count || 0 }}
                    span.count(:class="{ empty: !(popularity.get(m.id)?.upvotes) }") {{ popularity.get(m.id)?.upvotes ?? 0 }}
                  .pop-item
                    q-btn(:size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'video')")
                    span.count.empty 0
          // Legacy overlay path (no reserved bars)
          template(v-else)
            // Stable inner wrapper that also paints a blurred ambient backdrop
            .media-fill(:style="{ '--mg-media-bg': `url('${barBgUrlFor(m)}')` }")
              // Only mount heavy content when visible
              template(v-if="isVisible(m.id)")
                template(v-if="shouldMaskNsfw(m)")
                  div.nsfw-overlay(@click.stop="handleSelect(m, index)")
                    q-icon(name="sym_o_visibility_off" size="36px")
                    span.nsfw-label NSFW Content
                    span.nsfw-helper Tap to confirm viewing
                template(v-else)
                  div.loading-overlay(v-if="showVideoOverlay(m.id) && hasVideoSource(m.id)")
                    div.loading-overlay__stack
                      q-spinner-gears(color="grey-10" size="clamp(64px, 60%, 120px)" class="loading-overlay__spinner")
                      span.loading-overlay__label Loading
                  div(v-if="hasVideoSource(m.id)" style="position: relative; overflow: hidden; width: 100%; height: 100%;")
                    video(
                      :src="videoSources[m.id]"
                      :key="videoReloadKey[m.id]"
                      :data-id="m.id"
                      loop autoplay muted playsinline preload="auto"
                      :poster="videoPosterFor(m.id)"
                      @loadstart="markVideoLoadStart(m.id)"
                      @canplay="markVideoLoaded(m.id)"
                      @loadeddata="markVideoLoaded(m.id)"
                      @error="markVideoErrored(m.id)"
                      @click="handleSelect(m, index)"
                      style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block"
                      :class="videoClass(m)"
                    )
                  div(v-else style="position: relative; overflow: hidden; width: 100%; height: 100%;")
                    q-img(
                      :src="videoPosterFor(m.id)"
                      style="width: 100%; height: 100%; object-fit: cover; object-position: top; display: block;"
                      :class="props.selectable ? 'cursor-pointer' : ''"
                      no-spinner
                      no-transition
                      @click="handleSelect(m, index)"
                    )
              template(v-else)
                // Offscreen: render a lightweight black placeholder to avoid blank gaps
                div.media-placeholder
            // Top actions overlay (centered; matches bottom popularity row style)
            .top-actions-overlay(
              v-if="isVisible(m.id) && !shouldMaskNsfw(m) && !showVideoOverlay(m.id) && !(isPhone && layoutEffective === 'mosaic') && (canDelete(m) || canTogglePrivacy(m) || (props.showUseAsInput && !m.placeholder && (m.type === 'image' || m.mediaType === 'image')) || showCreatorFor(m))"
            )
              // Creator profile chip (avatar + @username)
              .creator-meta(v-if="showCreatorFor(m)" @click.stop="goToCreator(m)")
                q-img(:src="avatarImg(m.creatorId || '')" style="width:18px; height:18px; border-radius:50%;")
                .creator-name(:title="'@' + (m.creatorUsername || '')") @{{ m.creatorUsername }}
              // Add as input (images only; for video items this won't show)
              q-btn(v-if="props.showUseAsInput && !m.placeholder && (m.type === 'image' || m.mediaType === 'image')" :size="popIconSize" flat dense round color="white" icon="add_photo_alternate" @click.stop="addAsInput(m.id)" :loading="!!addInputLoading[m.id]" :disable="addInputLoading[m.id] === true")
              // Delete
              q-btn(v-if="canDelete(m)" :size="popIconSize" flat dense round color="white" icon="delete" @click.stop="handleDeleteClick(m)" :loading="!!deleteLoading[m.id]" :disable="deleteLoading[m.id] === true")
              // Visibility toggle
              q-btn(v-if="canTogglePrivacy(m)" :size="popIconSize" flat dense round color="white" :icon="m.isPublic ? 'public' : 'visibility_off'" @click.stop="handleVisibilityClick(m)" :loading="!!privacyLoading[m.requestId || '']" :disable="privacyLoading[m.requestId || ''] === true")
                q-tooltip {{ m.isPublic ? 'Currently public. Click to make private.' : 'Currently private. Click to make public.' }}
            // Hidden overlay - keeps layout stable
            .hidden-overlay(v-if="popularity.get(m.id)?.hidden")
              .hidden-text Hidden
              q-btn(size="sm" color="orange" flat @click.stop="popularity.unhide(m.id, 'video')" label="Unhide")
            // Model chip (bottom-left)
            .model-chip(
              v-if="isVisible(m.id) && !shouldMaskNsfw(m) && getModelLabel(m)"
              :class="{ 'is-clickable': props.enableModelChipSelect }"
              @click.stop="onModelChipClick(m)"
            ) {{ getModelLabel(m) }}
            // Popularity overlay controls
            .popularity-overlay(:class="popularityLayoutClass(m)" v-if="props.showPopularity && !shouldMaskNsfw(m) && isVisible(m.id) && !(isPhone && layoutEffective === 'mosaic')")
              .pop-row(:class="{ 'has-any-counts': !!((popularity.get(m.id)?.favorites) || (popularity.get(m.id)?.commentsCount) || (popularity.get(m.id)?.upvotes)) }")
                .pop-item
                  q-btn(:size="popIconSize" flat dense round icon="favorite" :color="popularity.get(m.id)?.isFavoritedByMe ? 'red-5' : 'white'" @click.stop="onFavorite(m.id, 'video')")
                  span.count(:class="{ empty: !(popularity.get(m.id)?.favorites) }") {{ popularity.get(m.id)?.favorites ?? 0 }}
                .pop-item
                  q-btn(:size="popIconSize" flat dense round icon="chat_bubble" color="white" @click.stop="openCommentsFromOverlay(m)")
                  span.count(:class="{ empty: !(popularity.get(m.id)?.commentsCount) }") {{ popularity.get(m.id)?.commentsCount ?? 0 }}
                .pop-item
                  .upvote-burst-wrap
                    q-btn(:size="popIconSize" flat dense round :icon="popularity.get(m.id)?.isUpvotedByMe ? 'img:/upvote-fire.png' : 'img:/upvote-fire-dull.png'" @click.stop="onUpvote(m.id, 'video')")
                    transition(name="burst")
                      .upvote-burst(v-if="upvoteBursts[m.id]?.visible") | +{{ upvoteBursts[m.id]?.count || 0 }}
                  span.count(:class="{ empty: !(popularity.get(m.id)?.upvotes) }") {{ popularity.get(m.id)?.upvotes ?? 0 }}
                .pop-item
                  q-btn(:size="popIconSize" flat dense round icon="thumb_down" color="white" @click.stop="popularity.downvoteAndHide(m.id, 'video')")
                  span.count.empty 0
          // Per-item actions slot (optional)
          //- slot(name="actions" :media="m" :index="index")
            // default empty
</template>

<style>
/* Transition-group moves disabled intentionally for snappier updates */

/* Skeleton grid sizing */
.mg-grid {
  width: 100%;
}
.mg-skel-cell {
  width: 100%;
  height: auto;
  min-height: 0;
  position: relative;
}
.mg-skel-box {
  width: 100%;
  height: 100%;
  min-height: 96px;
  border-radius: 6px;
}
.media-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #000; /* black backdrop before media loads */
}

.media-fill {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000; /* ensure offscreen/unmounted area is black */
  /* Ensure preview remains paintable */
  content-visibility: visible;
}

/* Inner aspect box used when reserved bars are enabled */
.media-aspect {
  background: #000; /* black before image/video renders */
  /* Ensure preview remains paintable */
  content-visibility: visible;
}

/* Blurred ambient backdrop behind media while loading
   Uses the same source as the bar blur but slightly less blurred */
.media-aspect::before,
.media-fill::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--mg-media-bg, none);
  background-size: cover;
  /* Match actual media crop to avoid pop when swapping */
  background-position: top;
  /* filter: blur(5px); disable blur for now */
  /* Do not zoom or darken the preview to match final image framing */
  transform: none;
  opacity: 1;
  z-index: 0;
}
/* Ensure media content renders above the ambient backdrop */
.media-aspect > *,
.media-fill > * {
  position: relative;
  z-index: 1;
}

.media-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000; /* black placeholder */
}

.media-wrapper.mode-grid .media-placeholder {
  height: auto;
}

.media-wrapper.mode-grid .media-placeholder::before {
  content: "";
  display: block;
  padding-top: 100%;
}

.media-placeholder--pending {
  color: white;
}

/* Transparent spacer used when offscreen but preview should remain visible */
.media-spacer {
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: none;
}

.media-container img,
.media-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-cell {
  position: relative;
  min-width: 0;
}

.media-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  /* Smooth selection feedback */
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
  /* Ensure absolutely-positioned overlays never push outside tiles */
  overflow: hidden;
}

.media-wrapper.mode-grid {
  /* Ensure spinner/gears stay visible in grid */
  min-height: 120px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Do not darken the blurred preview during load */
  background: transparent;
  color: white;
  z-index: 2;
  pointer-events: none;
}

.loading-overlay__stack {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.loading-overlay__spinner {
  position: relative;
  z-index: 0;
  opacity: 0.85;
}

.loading-overlay__label {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  z-index: 1; /* ensure text renders above spinner */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

/* Selected state: subtle scale + inset highlight */
.media-cell.is-selected .media-wrapper {
  transform: scale(0.965);
  box-shadow: 0 0 0 3px var(--q-secondary) inset;
  border-radius: 6px;
}

/* Explicit selection ring drawn above media content */
.media-cell.is-selected .media-wrapper::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 3px solid var(--q-secondary);
  border-radius: 6px;
  pointer-events: none;
  z-index: 3;
}

.media-wrapper > [slot="actions"],
.media-wrapper ::v-slotted([name="actions"]) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 6px 4px;
  display: flex;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.2), transparent);
  z-index: 2;
  pointer-events: auto;
}

/* Reserved bars (when enabled) */
.mg-topbar,
.mg-bottombar {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 10px; /* add breathing room so icons don't hug the image */
  position: relative;
  overflow: hidden;
}
.mg-topbar {
  /* dark background to visually connect with media */
  background: rgba(0, 0, 0, 0.25); /* lighten bar */
}
.mg-bottombar {
  background: rgba(0, 0, 0, 0.25); /* lighten bar */
}
.mg-topbar::before,
.mg-bottombar::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--mg-bar-bg, none);
  background-size: cover;
  filter: blur(10px);
  transform: scale(1.25);
  opacity: 0.5; /* show more image, reduce darkness */
  z-index: 0;
}
/* Make bars reflect the image edge they align to */
.mg-topbar::before {
  background-position: center top;
}
.mg-bottombar::before {
  background-position: center bottom;
}
.mg-topbar::after,
.mg-bottombar::after {
  content: "";
  position: absolute;
  inset: 0;
  /* light vignette to improve contrast atop the blurred bg */
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.06));
  z-index: 0;
}
.mg-topbar > *,
.mg-bottombar > * {
  position: relative;
  z-index: 1;
  /* Slightly fade bar content to blend with the image */
  opacity: 0.9;
}
.mg-topbar.with-creator {
  justify-content: space-between;
}
.mg-bottombar.with-creator {
  justify-content: space-between;
}
.mg-topbar .creator-meta,
.mg-bottombar .creator-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex: 1 1 auto; /* take remaining space */
  min-width: 0; /* allow text to ellipsis */
  max-width: none;
  overflow: hidden;
}
.mg-topbar .creator-meta .creator-name,
.mg-bottombar .creator-meta .creator-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
}
.mg-topbar .bar-actions {
  flex: 0 0 auto;
}
.mg-bottombar .pop-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  column-gap: 10px;
}
.mg-bottombar .pop-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 0;
  justify-content: center;
}
.mg-bottombar .count {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}
.mg-bottombar .count.empty {
  display: none;
}
.mg-bottombar .q-btn {
  min-width: 0;
}

/* Slightly larger spacing on small screens */
@media (max-width: 600px) {
  .mg-topbar,
  .mg-bottombar {
    gap: 12px;
    padding: 10px 12px;
  }
}

/* Centered top actions row (matches bottom popularity overlay) */
.top-actions-overlay {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.15);
  color: white;
  border-radius: 12px;
  padding: 4px 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  z-index: 3;
  pointer-events: none;
  /* Disable costly blur by default; enable on hover below */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-sizing: border-box;
}
.top-actions-overlay .q-btn {
  pointer-events: auto;
}

/* Make creator chip clickable within overlay and keep text tidy */
.top-actions-overlay .creator-meta {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.top-actions-overlay .creator-meta .creator-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Lower the absolute-center slightly to appear visually centered within varying thumbnails */
.absolute-center.offset-down {
  top: 58% !important;
}

.popularity-overlay {
  position: absolute;
  bottom: 5px;
  left: 50%;
  background: rgba(0, 0, 0, 0.15);
  transform: translateX(-50%);

  color: white;
  border-radius: 12px;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  row-gap: 2px;
  max-width: 80%;
  z-index: 3;
  pointer-events: none;
  /* Disable costly blur by default; enable on hover below */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-sizing: border-box;
}
.popularity-overlay .pop-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.popularity-overlay .pop-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.popularity-overlay .count {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}
.popularity-overlay .count.empty {
  display: none;
}
.popularity-overlay .q-btn,
.popularity-overlay .count {
  pointer-events: auto;
}

/* Desktop: keep overlay controls faint until hover/focus for subtle affordance */
@media (hover: hover) and (pointer: fine) {
  .media-wrapper .top-actions-overlay,
  .media-wrapper .popularity-overlay {
    opacity: 0.25;
    transition: opacity 320ms ease;
  }
  .media-wrapper:hover .top-actions-overlay,
  .media-wrapper:hover .popularity-overlay,
  .media-wrapper:focus-within .top-actions-overlay,
  .media-wrapper:focus-within .popularity-overlay {
    opacity: 1;
    /* Turn on blur at hover start to keep idle scroll cheap */
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}

/* Always keep blur off on touch-only devices to avoid paint cost */
@media (hover: none), (pointer: coarse) {
  .top-actions-overlay,
  .popularity-overlay {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}

/* Reduce cross-tile invalidation during scroll */
.media-wrapper {
  contain: paint;
}

/* Small chip in bottom-left for model name */
.model-chip {
  position: absolute;
  left: 6px;
  bottom: 6px;
  max-width: 62%;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 1.3;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 999px;
  backdrop-filter: blur(6px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 3;
  pointer-events: none;
}
.model-chip.is-clickable {
  cursor: pointer;
  pointer-events: auto;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}
.model-chip.is-clickable:hover {
  background: var(--q-primary);
  color: #fff;
}

.hidden-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  z-index: 4;
  pointer-events: auto;
  text-align: center;
}
.hidden-overlay .hidden-text {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.95;
}

.nsfw-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px;
  /* Fully opaque black to completely mask NSFW previews */
  background: #000;
  color: white;
  text-align: center;
  cursor: pointer;
  z-index: 3;
  border-radius: 4px;
}
.nsfw-overlay .nsfw-label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.nsfw-overlay .nsfw-helper {
  font-size: 12px;
  opacity: 0.85;
}
/* Upvote "+N" burst */
.upvote-burst-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.popularity-overlay .upvote-burst-wrap {
  pointer-events: auto;
}
.upvote-burst {
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translate(-50%, 0);
  background: rgba(0, 0, 0, 0.45);
  color: #d68834;
  font-weight: 700;
  font-size: 18px;
  line-height: 1;
  padding: 8px 12px;
  border-radius: 999px;
  pointer-events: none;
  white-space: nowrap;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
}

/* Pinch zoom overlay */
.pinch-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none; /* let original element keep receiving touch events */
}
.pinch-zoom-img {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  transition: transform 120ms ease;
  user-select: none;
  touch-action: none;
}

/* transition for the burst popup */
.burst-enter-active,
.burst-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.burst-enter-from {
  opacity: 0;
  transform: translate(-50%, 6px) scale(0.95);
}
.burst-enter-to {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.burst-leave-from {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.burst-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px) scale(0.98);
}

/* Mobile compaction for popularity controls; stack only when marked */
@media (max-width: 600px) {
  /* Default mobile baseline (keeps desktop look when unspecified) */
  .popularity-overlay {
    padding: 2px 4px;
    gap: 6px;
    row-gap: 0;
    max-width: calc(100% - 8px);
  }

  /* Grid mode on phones: larger targets and spacing */
  .popularity-overlay.mode-grid {
    padding: 6px 10px;
    gap: 10px;
    row-gap: 4px;
    max-width: calc(100% - 12px);
  }
  .popularity-overlay.mode-grid .count {
    font-size: 13px;
  }

  .popularity-overlay.stack-mobile .pop-item {
    flex-direction: column-reverse; /* show count above icon */
    align-items: center;
    gap: 2px;
  }
  .popularity-overlay.stack-mobile .count {
    display: block;
    font-size: 10px;
    line-height: 1;
    opacity: 0.9;
  }
  .popularity-overlay.stack-mobile .count.empty {
    display: block;
    visibility: hidden; /* reserve space for zero counts */
  }
  /* If all counts are zero, remove the spacer row entirely */
  .popularity-overlay.stack-mobile .pop-row:not(.has-any-counts) .count.empty {
    display: none;
  }
  .popularity-overlay .q-btn {
    min-width: 0;
    padding: 0;
  }
}
/* Soft culling: only apply content-visibility when items are far from viewport */
.media-wrapper.is-cull .media-fill,
.media-wrapper.is-cull .media-aspect {
  content-visibility: auto;
  contain-intrinsic-size: 320px; /* approximate tile size to avoid layout jump */
}
</style>
