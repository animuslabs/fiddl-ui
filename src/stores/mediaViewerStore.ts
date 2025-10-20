import { defineStore } from "pinia"
import { LocalStorage, SessionStorage } from "quasar"
import type { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { collectionsMediaInUsersCollection, creationsGetCreationData, creationsHdVideo } from "src/lib/orval"
import { img, s3Video } from "src/lib/netlifyImg"
import { catchErr, isRateLimitError } from "src/lib/util"
import { markOwned, isOwned } from "lib/ownedMediaCache"
import { hdUrl } from "lib/imageCdn"
import { useUserAuth } from "src/stores/userAuth"
import { useCreatorStore } from "src/stores/creatorStore"

interface CreatorMeta {
  userName: string
  id: string
}

interface TouchState {
  startX: number
  moveX: number
  isSwiping: boolean
  threshold: number
}

interface CachedRequestMeta {
  requestId: string | null
  creatorId: string
  creatorName: string
}

interface CachedLikeMeta {
  liked: boolean
}

const META_CACHE_LIMIT = 150
const META_CACHE_TTL = 1000 * 60 * 5 // 5 minutes
const LIKE_CACHE_LIMIT = 300
const LIKE_CACHE_TTL = 1000 * 30 // 30 seconds

const requestMetaCache = new Map<string, { data: CachedRequestMeta; ts: number }>()
const requestMetaInFlight = new Map<string, Promise<CachedRequestMeta | null>>()
const likeCache = new Map<string, { data: CachedLikeMeta; ts: number }>()
const likeInFlight = new Map<string, Promise<CachedLikeMeta | null>>()

function mediaKey(id: string, type: "image" | "video"): string {
  return `${type}:${id}`
}

function getCachedRequestMeta(key: string): CachedRequestMeta | null {
  const entry = requestMetaCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > META_CACHE_TTL) {
    requestMetaCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedRequestMeta(key: string, data: CachedRequestMeta) {
  requestMetaCache.set(key, { data, ts: Date.now() })
  if (requestMetaCache.size > META_CACHE_LIMIT) {
    const iterator = requestMetaCache.keys()
    const removeCount = requestMetaCache.size - META_CACHE_LIMIT
    for (let i = 0; i < removeCount; i++) {
      const next = iterator.next()
      if (next.done) break
      requestMetaCache.delete(next.value)
    }
  }
}

function getCachedLikeMeta(key: string): CachedLikeMeta | null {
  const entry = likeCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > LIKE_CACHE_TTL) {
    likeCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedLikeMeta(key: string, data: CachedLikeMeta) {
  likeCache.set(key, { data, ts: Date.now() })
  if (likeCache.size > LIKE_CACHE_LIMIT) {
    const iterator = likeCache.keys()
    const removeCount = likeCache.size - LIKE_CACHE_LIMIT
    for (let i = 0; i < removeCount; i++) {
      const next = iterator.next()
      if (next.done) break
      likeCache.delete(next.value)
    }
  }
}

export const useMediaViewerStore = defineStore("mediaViewerStore", {
  state: () => ({
    // Media data
    mediaObjects: [] as MediaGalleryMeta[],
    currentIndex: 0,
    muted: true,
    // Loading states
    imgLoading: true,
    hdVideoLoading: false,
    loading: false,
    triedHdLoad: false,
    hdMediaLoaded: false,
    firstImageLoaded: false,
    hdImageSrc: {} as Record<string, string>,
    // Progressive image loading: keep a mid-tier (lg) cache as a step-up from sm
    lgImageSrc: {} as Record<string, string>,
    // The URL currently displayed for each image id (sm -> lg -> hd)
    displayImageSrc: {} as Record<string, string>,
    // Track whether the HD asset has fully loaded per image id
    hdReady: {} as Record<string, boolean>,
    hdVideoUrl: {} as Record<string, string>,

    // User states
    userOwnsMedia: false,
    userLikedMedia: false,
    loadingLike: false,

    // Touch/swipe state
    touchState: {
      startX: 0,
      moveX: 0,
      isSwiping: false,
      threshold: 50,
    } as TouchState,

    // Creator and request data
    creatorMeta: {
      userName: "",
      id: "",
    } as CreatorMeta,
    loadedRequestId: null as string | null,

    // UI states
    shareMenu: true,
    moreOptionsMenu: false,
    downloadMode: false,
    isPersistent: false,
    activeVideoElement: null as HTMLVideoElement | null,
    loadSequence: 0,
    rateLimitActive: false,
    rateLimitUntil: 0,
    rateLimitTimer: null as number | null,
  }),

  getters: {
    currentMediaId: (state): string => {
      if (state.mediaObjects.length === 0) return ""
      return state.mediaObjects[state.currentIndex]?.id as string
    },

    currentMediaType: (state): "image" | "video" => {
      const media = state.mediaObjects[state.currentIndex]
      return media?.type || "image"
    },

    favoriteBtnColor: (state): string => {
      return state.userLikedMedia ? "accent" : state.userOwnsMedia ? "grey-5" : "grey-6"
    },

    editBtnColor: (state): string => {
      return state.userOwnsMedia ? "primary" : "grey-6"
    },

    downloadClass: (state): string => {
      return state.userOwnsMedia ? "text-primary" : "text-grey-6"
    },
  },

  actions: {
    // Get current media URL
    getCurrentMediaUrl(): string {
      const id = this.currentMediaId
      if (this.currentMediaType === "image") {
        // Drive UI from an explicit display url that we promote as loads complete
        return this.displayImageSrc[id] || this.hdImageSrc[id] || this.lgImageSrc[id] || img(id, "md")
      }
      return this.hdVideoUrl[id] || s3Video(id, "preview-lg")
    },

    // Get next media URL for preloading
    getNextMediaUrl(): string {
      const currentUrl = this.getCurrentMediaUrl()
      if (this.mediaObjects.length === 1) return currentUrl

      const nextIndex = this.touchState.moveX > 0 ? (this.currentIndex - 1 + this.mediaObjects.length) % this.mediaObjects.length : (this.currentIndex + 1) % this.mediaObjects.length

      const id = this.mediaObjects[nextIndex]?.id as string
      const mediaType = this.mediaObjects[nextIndex]?.type || "image"

      if (mediaType === "image") {
        return this.displayImageSrc[id] || this.hdImageSrc[id] || this.lgImageSrc[id] || img(id, "lg")
      }
      return this.hdVideoUrl[id] || s3Video(id, "preview-lg")
    },

    // Get media params for API calls
    getMediaParams(id?: string, type?: "image" | "video"): any {
      const mediaId = id || this.currentMediaId
      const inferredType = type || (id ? ((this.mediaObjects.find((m) => m.id === id)?.type as "image" | "video" | undefined) ?? this.currentMediaType) : this.currentMediaType)
      return inferredType === "video" ? { videoId: mediaId } : { imageId: mediaId }
    },

    // Get dialog params
    getDialogParams() {
      return {
        userOwnsMedia: this.userOwnsMedia,
        currentMediaId: this.currentMediaId,
        type: this.currentMediaType,
      }
    },

    // Optimistically mark current media as owned (call when user unlocks in a dialog)
    setOwnedOptimistic() {
      this.userOwnsMedia = true
    },

    // Initialize media viewer
    async initializeMediaViewer(mediaObjects: MediaGalleryMeta[], startIndex = 0, startId?: string) {
      // Filter out any placeholder/pending tiles that can appear in galleries
      const isPlaceholder = (m: MediaGalleryMeta) => m?.placeholder === true || (typeof m?.id === "string" && m.id.startsWith("pending-"))

      const filtered = mediaObjects.filter((m) => !isPlaceholder(m))

      // Derive the intended starting media by id, then remap to filtered list
      const idHint = startId || mediaObjects?.[startIndex]?.id
      let mappedIndex = 0
      if (idHint) {
        const idx = filtered.findIndex((m) => m.id === idHint)
        mappedIndex = idx >= 0 ? idx : Math.min(Math.max(startIndex, 0), Math.max(filtered.length - 1, 0))
      }

      this.mediaObjects = filtered
      this.currentIndex = mappedIndex
      this.resetStates()
      // Instant ownership from cache
      if (isOwned(this.currentMediaId, this.currentMediaType)) this.userOwnsMedia = true
      this.syncDisplaySource(this.currentMediaId)
      await this.loadRequestId()
    },

    // Reset all states
    resetStates() {
      this.beginNewLoadSequence()
      this.imgLoading = true
      this.hdVideoLoading = false
      this.loading = false
      this.triedHdLoad = false
      this.hdMediaLoaded = false
      this.firstImageLoaded = false
      // Do not clear lg/hd caches globally here; they are keyed per-id and safe to persist between opens
      this.userOwnsMedia = false
      this.userLikedMedia = false
      this.loadingLike = false
      this.touchState = {
        startX: 0,
        moveX: 0,
        isSwiping: false,
        threshold: 50,
      }
      this.creatorMeta = { userName: "", id: "" }
      this.loadedRequestId = null
      this.shareMenu = false
      this.moreOptionsMenu = false
      this.downloadMode = false
      if (this.rateLimitTimer != null) {
        window.clearTimeout(this.rateLimitTimer)
        this.rateLimitTimer = null
      }
      this.rateLimitActive = false
      this.rateLimitUntil = 0
    },

    // Update muted state and optionally persist it
    setMuted(muted: boolean) {
      this.muted = muted
      // Persist mute preference in localStorage
      LocalStorage.setItem("videoMuted", muted)
    },

    registerVideoElement(element: HTMLVideoElement | null) {
      this.activeVideoElement = element
    },

    beginNewLoadSequence() {
      this.loadSequence = (this.loadSequence + 1) % Number.MAX_SAFE_INTEGER
      return this.loadSequence
    },

    startRateLimitCooldown(durationMs = 5000) {
      const resumeAt = Date.now() + durationMs
      if (this.rateLimitTimer != null) {
        window.clearTimeout(this.rateLimitTimer)
      }
      this.rateLimitActive = true
      this.triedHdLoad = false
      this.rateLimitUntil = resumeAt
      this.touchState.isSwiping = false
      this.touchState.moveX = 0
      this.touchState.startX = 0
      this.rateLimitTimer = window.setTimeout(() => {
        if (Date.now() >= this.rateLimitUntil) {
          this.endRateLimitCooldown()
        }
      }, durationMs)
    },

    endRateLimitCooldown() {
      if (this.rateLimitTimer != null) {
        window.clearTimeout(this.rateLimitTimer)
        this.rateLimitTimer = null
      }
      this.rateLimitActive = false
      this.rateLimitUntil = 0
      const hasMedia = this.mediaObjects.length > 0 && this.currentMediaId
      if (hasMedia) {
        void this.checkUserLikedMedia()
        void this.loadRequestId()
        void this.loadHdMedia()
      }
    },

    isActiveLoadSequence(seq: number, mediaId?: string) {
      if (seq !== this.loadSequence) return false
      if (!mediaId) return true
      return this.currentMediaId === mediaId
    },

    pauseActiveVideo() {
      const video = this.activeVideoElement
      if (!video) return
      if (!video.paused) {
        video.pause()
      }
    },

    playActiveVideo() {
      const video = this.activeVideoElement
      if (!video) return
      void video.play().catch(() => {})
    },

    // Load muted preference from localStorage
    loadMutedPreference() {
      const savedMuted = LocalStorage.getItem<boolean>("videoMuted")
      if (savedMuted !== null) {
        this.muted = savedMuted
      }
    },

    // Reset creator info when changing media
    resetCreatorInfo() {
      this.creatorMeta = { userName: "", id: "" }
      this.loadedRequestId = null
    },

    // Navigation
    goToIndex(index: number) {
      if (this.rateLimitActive) {
        this.touchState.moveX = 0
        return
      }
      if (index >= 0 && index < this.mediaObjects.length) {
        if (index === this.currentIndex) return
        this.beginNewLoadSequence()
        this.imgLoading = true
        this.currentIndex = index
        this.touchState.moveX = 0
        this.loadingLike = false
        this.hdVideoLoading = false
        this.hdMediaLoaded = false
        this.triedHdLoad = false
        this.userLikedMedia = false
        this.userOwnsMedia = isOwned(this.currentMediaId, this.currentMediaType)
        this.syncDisplaySource(this.currentMediaId)
      }
    },

    nextMedia() {
      if (this.rateLimitActive) {
        this.touchState.moveX = 0
        return
      }
      if (this.mediaObjects.length === 1) return
      this.beginNewLoadSequence()
      this.imgLoading = true
      this.loadingLike = false
      this.currentIndex = (this.currentIndex + 1) % this.mediaObjects.length
      this.touchState.moveX = 0
      this.hdVideoLoading = false
      this.hdMediaLoaded = false
      this.triedHdLoad = false
      this.userLikedMedia = false
      this.userOwnsMedia = isOwned(this.currentMediaId, this.currentMediaType)
      this.syncDisplaySource(this.currentMediaId)
    },

    prevMedia() {
      if (this.rateLimitActive) {
        this.touchState.moveX = 0
        return
      }
      if (this.mediaObjects.length === 1) return
      this.beginNewLoadSequence()
      this.imgLoading = true
      this.loadingLike = false
      this.currentIndex = (this.currentIndex - 1 + this.mediaObjects.length) % this.mediaObjects.length
      this.touchState.moveX = 0
      this.hdVideoLoading = false
      this.hdMediaLoaded = false
      this.triedHdLoad = false
      this.userLikedMedia = false
      this.userOwnsMedia = isOwned(this.currentMediaId, this.currentMediaType)
      this.syncDisplaySource(this.currentMediaId)
    },

    // Touch handling
    handleTouchStart(clientX: number) {
      if (this.rateLimitActive) return
      this.touchState.startX = clientX
      this.touchState.isSwiping = true
      this.touchState.moveX = 0
    },

    handleTouchMove(clientX: number) {
      if (this.rateLimitActive) {
        this.touchState.moveX = 0
        return
      }
      if (!this.touchState.isSwiping) return
      if (this.mediaObjects.length === 1) {
        this.touchState.moveX = 0
        return
      }
      const deltaX = clientX - this.touchState.startX
      this.touchState.moveX = deltaX
    },

    handleTouchEnd() {
      if (this.rateLimitActive) {
        this.touchState.isSwiping = false
        this.touchState.moveX = 0
        return
      }
      if (!this.touchState.isSwiping) return
      this.touchState.isSwiping = false
      const deltaX = this.touchState.moveX

      if (Math.abs(deltaX) > this.touchState.threshold) {
        if (deltaX > 0) {
          this.prevMedia()
        } else {
          this.nextMedia()
        }
      } else {
        this.touchState.moveX = 0
      }
    },

    // Media loading
    async loadHdMedia(id?: string) {
      if (this.rateLimitActive) return
      const mediaId = id || this.currentMediaId
      if (!mediaId) return
      const loadSeq = this.loadSequence
      const mediaType = id != null ? ((this.mediaObjects.find((m) => m.id === mediaId)?.type as "image" | "video" | undefined) ?? "image") : this.currentMediaType
      if (this.triedHdLoad || this.hdMediaLoaded) return
      this.triedHdLoad = true
      // this.loading = true
      // preserve current userOwnsMedia to avoid flicker after unlock

      let timer: any | null = null
      const timeoutPromise = new Promise<null>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Media loading timed out"))
          if (this.isActiveLoadSequence(loadSeq, mediaId)) {
            this.loading = false
            this.imgLoading = false
          }
        }, 6000)
      })

      try {
        if (mediaType === "image") {
          await this.loadHdImage(mediaId, timeoutPromise, loadSeq)
        } else if (mediaType === "video") {
          await this.loadHdVideo(mediaId, loadSeq)
        }
      } catch (err) {
        console.error("Failed to load HD media:", err)
      } finally {
        if (timer) clearTimeout(timer)
        if (this.isActiveLoadSequence(loadSeq, mediaId)) {
          this.loading = false
        }
      }
    },

    // Progressive: load the LG image in the background and promote when ready
    async loadLgImage(id?: string) {
      if (this.rateLimitActive) return
      const mediaId = id || this.currentMediaId
      if (this.currentMediaType !== "image") return
      if (this.lgImageSrc[mediaId]) return
      const url = img(mediaId, "lg")
      await new Promise<void>((resolve) => {
        const im = new Image()
        im.onload = () => {
          this.lgImageSrc[mediaId] = url
          this.syncDisplaySource(mediaId)
          resolve()
        }
        im.onerror = () => resolve()
        im.src = url
      })
    },

    async loadHdImage(id: string, timeoutPromise: Promise<null>, loadSeq: number) {
      if (this.rateLimitActive) return null
      // If the user owns this media (optimistically or cached), do not block retries
      const owns = this.userOwnsMedia || isOwned(id, "image")
      if (!owns && SessionStorage.getItem(`noHdimage-${id}`)) return null
      const isActive = () => this.isActiveLoadSequence(loadSeq, id)
      try {
        const url = (await Promise.race([hdUrl(id), timeoutPromise])) as string | null
        if (url) {
          this.hdImageSrc[id] = url
          markOwned(id, "image")
          this.hdReady[id] = false
          // Clear any previous block for this image now that HD is available
          SessionStorage.removeItem(`noHdimage-${id}`)

          // If we are already displaying this HD URL (e.g., cached session), flag as loaded
          if (this.displayImageSrc[id] === url) {
            this.hdReady[id] = true
            if (isActive()) {
              this.hdMediaLoaded = true
              this.userOwnsMedia = true
              this.syncDisplaySource(id)
            }
            return url
          }

          await new Promise<void>((resolve) => {
            const imgEl = new Image()
            imgEl.onload = () => {
              this.hdReady[id] = true
              this.displayImageSrc[id] = url
              if (isActive()) {
                this.hdMediaLoaded = true
                this.userOwnsMedia = true
              }
              resolve()
            }
            imgEl.onerror = () => resolve()
            imgEl.src = url
          })

          this.syncDisplaySource(id)
          return url
        }
      } catch (err) {
        if (isRateLimitError(err)) {
          this.startRateLimitCooldown()
        } else {
          SessionStorage.setItem(`noHdimage-${id}`, true)
          console.error("Failed to load HD image:", err)
        }
      }
      return null
    },

    async loadHdVideo(id: string, loadSeq: number) {
      if (this.rateLimitActive) return
      const isActive = () => this.isActiveLoadSequence(loadSeq, id)
      if (isActive()) {
        this.hdVideoLoading = true
      }
      try {
        const { data: hdUrl } = await creationsHdVideo({ videoId: id })
        if (!hdUrl) return

        // optional persistence
        LocalStorage.setItem("hdVideoUrl-" + id, hdUrl)

        this.hdVideoUrl[id] = hdUrl
        if (isActive()) {
          this.hdMediaLoaded = true
          this.userOwnsMedia = true
        }
        markOwned(id, "video")
        return hdUrl
      } catch (err) {
        if (isRateLimitError(err)) {
          this.startRateLimitCooldown()
        } else {
          console.error("Failed to load HD video:", err)
        }
        return undefined
      } finally {
        if (isActive()) {
          this.hdVideoLoading = false
        }
      }
    },

    // User interactions
    async checkUserLikedMedia() {
      if (this.rateLimitActive) return false
      const mediaId = this.currentMediaId
      const mediaType = this.currentMediaType
      if (!mediaId) return false
      const loadSeq = this.loadSequence
      const isActive = () => this.isActiveLoadSequence(loadSeq, mediaId)

      const userAuth = useUserAuth()
      if (!userAuth.loggedIn) {
        if (isActive()) {
          this.userLikedMedia = false
          this.loadingLike = false
        }
        return false
      }

      const key = mediaKey(mediaId, mediaType)
      const cached = getCachedLikeMeta(key)
      if (cached) {
        if (isActive()) {
          this.userLikedMedia = cached.liked
          this.loadingLike = false
        }
        return cached.liked
      }

      const inFlight = likeInFlight.get(key)
      if (inFlight) {
        const result = await inFlight
        if (isActive()) {
          this.userLikedMedia = result?.liked ?? false
          this.loadingLike = false
        }
        return result?.liked ?? false
      }

      if (isActive()) {
        this.loadingLike = true
      }
      const promise = (async (): Promise<CachedLikeMeta | null> => {
        try {
          const response = await collectionsMediaInUsersCollection({
            ...this.getMediaParams(mediaId, mediaType),
            name: "likes",
          })
          const liked = response?.data || false
          const payload: CachedLikeMeta = { liked }
          setCachedLikeMeta(key, payload)
          return payload
        } catch (err) {
          if (isRateLimitError(err)) {
            this.startRateLimitCooldown()
          } else {
            console.error("Failed to check like status:", err)
          }
          return null
        } finally {
          likeInFlight.delete(key)
          if (isActive()) {
            this.loadingLike = false
          }
        }
      })()

      likeInFlight.set(key, promise)
      const payload = await promise
      const liked = payload?.liked ?? false
      if (isActive()) {
        this.userLikedMedia = liked
      }
      return liked
    },

    async loadRequestId() {
      if (this.rateLimitActive) {
        return null
      }
      const mediaId = this.currentMediaId
      const mediaType = this.currentMediaType
      if (!mediaId) {
        this.loadedRequestId = null
        this.creatorMeta = { userName: "", id: "" }
        return null
      }
      const loadSeq = this.loadSequence
      const isActive = () => this.isActiveLoadSequence(loadSeq, mediaId)

      const key = mediaKey(mediaId, mediaType)
      const creatorStore = useCreatorStore()
      const cached = getCachedRequestMeta(key)
      if (cached) {
        if (cached.creatorId && cached.creatorName) {
          void creatorStore.rememberOne(cached.creatorId, cached.creatorName)
        }
        if (isActive()) {
          this.loadedRequestId = cached.requestId
          this.creatorMeta = { id: cached.creatorId, userName: cached.creatorName }
        }
        return cached.requestId
      }

      const inflight = requestMetaInFlight.get(key)
      if (inflight) {
        const meta = await inflight
        if (meta?.creatorId && meta.creatorName) {
          void creatorStore.rememberOne(meta.creatorId, meta.creatorName)
        }
        if (meta) {
          if (isActive()) {
            this.loadedRequestId = meta.requestId
            this.creatorMeta = { id: meta.creatorId, userName: meta.creatorName }
          }
          return meta.requestId
        }
        return null
      }

      const promise = (async (): Promise<CachedRequestMeta | null> => {
        try {
          const response = await creationsGetCreationData(this.getMediaParams(mediaId, mediaType))
          const imageMeta = response?.data
          if (!imageMeta) return null

          const creatorId = imageMeta.creatorId || ""
          let creatorName = ""
          if (creatorId) {
            const cachedName = creatorStore.getUsername(creatorId)
            if (cachedName) {
              creatorName = cachedName
            } else {
              try {
                creatorName = await creatorStore.ensureUsername(creatorId)
              } catch (err) {
                if (isRateLimitError(err)) {
                  this.startRateLimitCooldown()
                } else {
                  catchErr(err)
                }
              }
            }
          }
          if (creatorId && creatorName) {
            void creatorStore.rememberOne(creatorId, creatorName)
          }

          const payload: CachedRequestMeta = {
            requestId: imageMeta.requestId,
            creatorId,
            creatorName,
          }
          setCachedRequestMeta(key, payload)
          return payload
        } catch (err) {
          if (isRateLimitError(err)) {
            this.startRateLimitCooldown()
          } else {
            catchErr(err)
          }
          return null
        } finally {
          requestMetaInFlight.delete(key)
        }
      })()

      requestMetaInFlight.set(key, promise)
      const payload = await promise
      if (payload) {
        if (isActive()) {
          this.loadedRequestId = payload.requestId
          this.creatorMeta = { id: payload.creatorId, userName: payload.creatorName }
        }
        return payload.requestId
      }

      if (isActive()) {
        this.loadedRequestId = null
        this.creatorMeta = { userName: "", id: "" }
      }
      return null
    },

    // Media removal (for delete functionality)
    removeMedia(mediaId: string) {
      this.mediaObjects = this.mediaObjects.filter((el) => el.id !== mediaId)

      if (this.mediaObjects.length === 0) {
        return true // Signal to close dialog
      }

      if (this.currentIndex >= this.mediaObjects.length) {
        this.currentIndex = this.mediaObjects.length - 1
      }

      return false
    },

    // Media loaded event
    onMediaLoaded(mediaId?: string) {
      if (mediaId && mediaId !== this.currentMediaId) return
      this.imgLoading = false
      this.firstImageLoaded = true
    },

    // HD media loaded event
    onHdMediaLoaded() {
      this.hdVideoLoading = false
      this.hdMediaLoaded = true
    },

    syncDisplaySource(mediaId: string | undefined) {
      if (!mediaId) return
      const media = this.mediaObjects.find((m) => m.id === mediaId)
      if (!media || media.type !== "image") return

      const hdUrl = this.hdImageSrc[mediaId]
      if (hdUrl && this.hdReady[mediaId]) {
        this.displayImageSrc[mediaId] = hdUrl
        return
      }

      const lgUrl = this.lgImageSrc[mediaId]
      if (lgUrl) {
        this.displayImageSrc[mediaId] = lgUrl
        return
      }

      this.displayImageSrc[mediaId] = img(mediaId, "md")
    },
  },
})
