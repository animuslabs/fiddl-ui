import { defineStore } from "pinia"
import { LocalStorage, SessionStorage } from "quasar"
import type { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import { collectionsMediaInUsersCollection, creationsGetCreationData, userGetUsername, creationsHdImage, creationsHdVideo } from "src/lib/orval"
import { getImageFromCache, storeImageInCache } from "src/lib/hdImageCache"
import { img, s3Video } from "src/lib/netlifyImg"
import { catchErr } from "src/lib/util"

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
        return this.hdImageSrc[id] || img(id, "lg")
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
        return this.hdImageSrc[id] || img(id, "lg")
      }
      return this.hdVideoUrl[id] || s3Video(id, "preview-lg")
    },

    // Get media params for API calls
    getMediaParams(id?: string): any {
      const mediaId = id || this.currentMediaId
      return this.currentMediaType === "video" ? { videoId: mediaId } : { imageId: mediaId }
    },

    // Get dialog params
    getDialogParams() {
      return {
        userOwnsMedia: this.userOwnsMedia,
        currentMediaId: this.currentMediaId,
        type: this.currentMediaType,
      }
    },

    // Initialize media viewer
    async initializeMediaViewer(mediaObjects: MediaGalleryMeta[], startIndex = 0) {
      this.mediaObjects = [...mediaObjects]
      this.currentIndex = startIndex
      this.resetStates()
      await this.loadRequestId()
    },

    // Reset all states
    resetStates() {
      this.imgLoading = true
      this.hdVideoLoading = false
      this.loading = false
      this.triedHdLoad = false
      this.hdMediaLoaded = false
      this.firstImageLoaded = false
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
    },

    // Update muted state and optionally persist it
    setMuted(muted: boolean) {
      this.muted = muted
      // Persist mute preference in localStorage
      LocalStorage.setItem("videoMuted", muted)
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
      if (index >= 0 && index < this.mediaObjects.length) {
        this.currentIndex = index
        this.touchState.moveX = 0
      }
    },

    nextMedia() {
      if (this.mediaObjects.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex + 1) % this.mediaObjects.length
      this.touchState.moveX = 0
    },

    prevMedia() {
      if (this.mediaObjects.length === 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex - 1 + this.mediaObjects.length) % this.mediaObjects.length
      this.touchState.moveX = 0
    },

    // Touch handling
    handleTouchStart(clientX: number) {
      this.touchState.startX = clientX
      this.touchState.isSwiping = true
      this.touchState.moveX = 0
    },

    handleTouchMove(clientX: number) {
      if (!this.touchState.isSwiping) return
      if (this.mediaObjects.length === 1) {
        this.touchState.moveX = 0
        return
      }
      const deltaX = clientX - this.touchState.startX
      this.touchState.moveX = deltaX
    },

    handleTouchEnd() {
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
      const mediaId = id || this.currentMediaId
      if (this.triedHdLoad || this.hdMediaLoaded) return
      this.triedHdLoad = true
      this.loading = true
      this.userOwnsMedia = false

      let timer: any | null = null
      const timeoutPromise = new Promise<null>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Media loading timed out"))
          this.loading = false
          this.imgLoading = false
        }, 6000)
      })

      try {
        if (this.currentMediaType === "image") {
          await this.loadHdImage(mediaId, timeoutPromise)
        } else if (this.currentMediaType === "video") {
          await this.loadHdVideo(mediaId)
        }
      } catch (err) {
        console.error("Failed to load HD media:", err)
      } finally {
        if (timer) clearTimeout(timer)
        this.loading = false
      }
    },

    async loadHdImage(id: string, timeoutPromise: Promise<null>) {
      let imageData = await getImageFromCache(id)
      if (!imageData && !SessionStorage.getItem(`noHdimage-${id}`)) {
        const hdResponse = await Promise.race([
          creationsHdImage({ imageId: id }).catch(() => {
            SessionStorage.setItem(`noHdimage-${id}`, true)
            return undefined
          }),
          timeoutPromise,
        ])
        imageData = hdResponse?.data
        if (imageData) await storeImageInCache(id, imageData)
      }

      if (imageData) {
        const src = `data:image/webp;base64,${imageData}`
        this.hdImageSrc[id] = src
        this.userOwnsMedia = true
        this.hdMediaLoaded = true
        return src
      }
      return null
    },

    async loadHdVideo(id: string) {
      this.hdVideoLoading = true
      try {
        const { data: hdUrl } = await creationsHdVideo({ videoId: id })
        if (!hdUrl) return

        // optional persistence
        LocalStorage.setItem("hdVideoUrl-" + id, hdUrl)

        this.hdVideoUrl[id] = hdUrl
        this.hdMediaLoaded = true
        this.userOwnsMedia = true
        return hdUrl
      } finally {
        this.hdVideoLoading = false
      }
    },

    // User interactions
    async checkUserLikedMedia() {
      this.loadingLike = true
      try {
        const response = await collectionsMediaInUsersCollection({
          ...this.getMediaParams(),
          name: "likes",
        })
        this.userLikedMedia = response?.data || false
      } catch (err) {
        console.error("Failed to check like status:", err)
      } finally {
        this.loadingLike = false
      }
    },

    async loadRequestId() {
      try {
        const imageResponse = await creationsGetCreationData(this.getMediaParams())
        const imageMeta = imageResponse?.data
        if (!imageMeta) return

        this.loadedRequestId = imageMeta.requestId
        const usernameResponse = await userGetUsername({ userId: imageMeta.creatorId })
        const creatorName = usernameResponse?.data || ""
        this.creatorMeta = { id: imageMeta.creatorId, userName: creatorName }
      } catch (err) {
        catchErr(err)
      }
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
    onMediaLoaded() {
      this.imgLoading = false
      this.firstImageLoaded = true
    },

    // HD media loaded event
    onHdMediaLoaded() {
      this.hdVideoLoading = false
      this.hdMediaLoaded = true
    },
  },
})
