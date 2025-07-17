import { defineStore } from "pinia"

import { creationsUserImagePurchases, collectionsFindCollectionByName, collectionsGetCollectionImages, createImage, type CreateImageBody, creationsCreateVideoRequests, creationsUserVideoPurchases, collectionsGetCollectionVideos, createVideo, type CreateVideo200 } from "lib/orval"
import type { CreateImageRequestData, CreateVideoRequest, CreateVideoRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import type { VideoRequest } from "fiddl-server/node_modules/@prisma/client"
import { useUserAuth } from "src/stores/userAuth"
import { Dialog } from "quasar"
import type { CreateImageRequestWithCustomModel } from "src/stores/createImageStore"
import type { AspectRatio, ImageModel, VideoModel, VideoModelData } from "lib/imageModels"
import type { VideoPurchase, Image, Video } from "lib/api"
import { catchErr } from "lib/util"
import type { UnifiedRequest } from "lib/types"

interface SceneConfig {
  number: number
  duration: number
}

interface OutputConfig {
  path?: string
  url?: string
  number?: number
  duration?: number
  interval?: number
  if?: string
  key?: string
  scene?: SceneConfig
  square?: boolean
}

interface CreationVideo {
  id: string
  creationId: string
}

export const useVideoCreations = defineStore("videoCreationsStore", {
  state: () => ({
    creations: [] as UnifiedRequest[],
    imagePurchases: [] as VideoPurchase[],
    favorites: [] as Video[],
    favoritesCollectionId: null as string | null,
    activeUserId: null as string | null,
    search: null as string | null,
    loadingCreations: false,
    dynamicModel: true,
    gridMode: false,
    filter: {
      aspectRatio: undefined as AspectRatio | undefined,
      model: undefined as VideoModel | undefined,
    },
  }),
  getters: {
    filterActive(): boolean {
      return !!this.filter.aspectRatio || !!this.filter.model
    },
    allCreations(): CreationVideo[] {
      const videos: CreationVideo[] = []
      for (const creation of this.creations) {
        for (const videoId of creation.mediaIds) {
          videos.push({ id: videoId, creationId: creation.id })
        }
      }
      return videos
    },
  },
  actions: {
    resetFilters() {
      this.search = null
      this.filter = {
        aspectRatio: undefined,
        model: undefined,
      }
    },
    searchCreations() {
      this.creations = []
      void this.loadCreations()
    },
    deleteCreation(creationId: string) {
      const index = this.creations.findIndex((i) => i.id === creationId)
      if (index === -1) return
      this.creations.splice(index, 1)
    },
    deleteVideo(videoId: string, creationId: string) {
      console.log("deleting", videoId, creationId)
      const creation = this.creations.find((i) => i.id === creationId)
      if (!creation) return
      console.log(creation)
      const index = creation.mediaIds.findIndex((id) => id === videoId)
      console.log("deleted video index", index)
      if (index === -1) return
      creation.mediaIds.splice(index, 1)
    },
    addItem(item: CreateVideoRequestData) {
      const idExists = this.creations.some((i) => i.id === item.id)
      if (idExists) return
      this.creations.push({
        ...item,
        type: "video",
        mediaIds: item.videoIds,
      })
    },
    reset() {
      this.creations = []
      this.imagePurchases = []
      this.favorites = []
      this.favoritesCollectionId = null
      this.activeUserId = null
    },
    async loadCreations(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      if (this.loadingCreations) {
        console.log("loadingCreations already in progress")
        return
      }
      this.loadingCreations = true
      try {
        this.activeUserId = userId
        const lastItem = this.creations[this.creations.length - 1]

        const response = await creationsCreateVideoRequests({
          userId,
          includeMetadata: true,
          order: "desc",
          endDateTime: lastItem?.createdAt?.toISOString(),
          limit: 20,
          promptIncludes: this.search || undefined,
          aspectRatio: this.filter.aspectRatio as any,
          model: this.filter.model,
        })

        const creations = response.data
        if (!creations) return

        for (const creation of creations) {
          this.addItem({
            ...creation,
            createdAt: new Date(creation.createdAt),
          })
        }
      } catch (err: any) {
        console.error("Error loading creations:", err)
        throw err
      } finally {
        this.loadingCreations = false
      }
    },
    async loadPurchases(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      this.activeUserId = userId
      const lastItem = this.imagePurchases[this.imagePurchases.length - 1]
      console.log("lastItem", lastItem)

      try {
        const response = await creationsUserVideoPurchases({
          userId,
          includeMetadata: true,
          order: "desc",
          endDateTime: lastItem?.createdAt ? lastItem.createdAt : undefined,
          limit: 20,
        })

        const purchases = response.data
        console.log("purchases", purchases)

        for (const purchase of purchases) {
          const idExists = this.imagePurchases.some((i) => i.id === purchase.id)
          if (!idExists) this.imagePurchases.push(purchase)
        }
      } catch (error) {
        console.error("Error loading purchases:", error)
        throw error
      }
    },
    async loadFavorites(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      if (this.activeUserId !== userId) this.favoritesCollectionId = null
      this.activeUserId = userId

      try {
        if (!this.favoritesCollectionId) {
          const response = await collectionsFindCollectionByName({
            collectionName: "likes",
            ownerId: userId,
          })
          this.favoritesCollectionId = response.data?.id || null
        }

        if (!this.favoritesCollectionId) return

        const response = await collectionsGetCollectionVideos({
          id: this.favoritesCollectionId,
        })
        const data = response.data
        // data[0].
        this.favorites = response.data.reverse()
      } catch (error) {
        console.error("Error loading favorites:", error)
        throw error
      }
    },
    async generateVideo(request: CreateVideoRequest) {
      const creatorId = useUserAuth().userId
      if (!creatorId) throw new Error("User not authenticated")
      if (!request.prompt) throw new Error("Prompt is required")
      if (typeof request.prompt !== "string") throw new Error("Prompt must be a string")
      let response
      try {
        response = await createVideo(request as any)
      } catch (err: any) {
        catchErr(err)
      }

      const result: CreateVideo200 = response.data

      if (!result) return

      const createdItem: UnifiedRequest = {
        ...request,
        mediaIds: result.videos.map((el) => el.id).reverse(),
        id: result.id,
        createdAt: new Date(),
        creatorId,
        type: "video",
      }

      this.creations.unshift(createdItem)
    },
  },
  persist: false,
})
