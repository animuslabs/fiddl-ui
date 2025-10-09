// @ts-nocheck
import { defineStore } from "pinia"

import { creationsUserImagePurchases, collectionsFindCollectionByName, collectionsGetCollectionImages, createImage, type CreateImageBody, creationsCreateImageRequests } from "lib/orval"
import type { CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import { useUserAuth } from "src/stores/userAuth"
import { Dialog } from "quasar"
import type { CreateImageRequestWithCustomModel } from "src/stores/createImageStore"
import type { AspectRatio, ImageModel } from "lib/imageModels"
import type { ImagePurchase, Image } from "lib/api"
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

type OutputValue = OutputConfig | Record<string, OutputConfig>

interface CreateJobOptions {
  sourceUrl: string
  outputBasePath?: string
  webhookUrl?: string
  previewSize?: number
  mediumSize?: string
  outputs?: Record<string, OutputValue>
}

interface CreationImage {
  id: string
  creationId: string
}

export const useImageCreations = defineStore("imageCreationsStore", {
  state: () => ({
    creations: [] as UnifiedRequest[],
    imagePurchases: [] as ImagePurchase[],
    favorites: [] as Image[],
    favoritesCollectionId: null as string | null,
    activeUserId: null as string | null,
    customModelId: null as string | null,
    search: null as string | null,
    loadingCreations: false,
    dynamicModel: true,
    gridMode: false,
    lastQueryKey: null as string | null,
    filter: {
      aspectRatio: undefined as AspectRatio | undefined,
      model: undefined as ImageModel | undefined,
      customModelId: undefined as string | undefined,
    },
  }),
  getters: {
    filterActive(): boolean {
      return !!this.filter.aspectRatio || !!this.filter.model
    },
    allCreations(): CreationImage[] {
      const images: CreationImage[] = []
      for (const creation of this.creations) {
        for (const imageId of creation.mediaIds) {
          images.push({ id: imageId, creationId: creation.id })
        }
      }
      return images
    },
  },
  actions: {
    resetFilters() {
      this.search = null
      this.filter = {
        aspectRatio: undefined,
        model: undefined,
        customModelId: undefined,
      }
    },
    searchCreations(targetUserId?: string | null) {
      // Refresh the list without clearing UI to avoid flicker
      void this.loadCreations(targetUserId, { reset: true, replace: true })
    },
    deleteCreation(creationId: string) {
      const index = this.creations.findIndex((i) => i.id === creationId)
      if (index === -1) return
      this.creations.splice(index, 1)
    },
    deleteImage(imageId: string, creationId: string) {
      const creation = this.creations.find((i) => i.id === creationId)
      if (!creation) return
      const index = creation.mediaIds.findIndex((id) => id === imageId)
      if (index === -1) return
      creation.mediaIds.splice(index, 1)
    },
    addItem(item: CreateImageRequestData) {
      const idExists = this.creations.some((i) => i.id === item.id)
      if (idExists) return
      this.creations.push({
        ...item,
        type: "image",
        mediaIds: item.imageIds,
      })
    },
    // Prepend a newly finished request so it appears at the top (under any placeholders)
    addItemToFront(item: CreateImageRequestData) {
      const idExists = this.creations.some((i) => i.id === item.id)
      if (idExists) return
      this.creations.unshift({
        ...item,
        type: "image",
        mediaIds: item.imageIds,
      })
    },
    reset() {
      this.creations = []
      this.imagePurchases = []
      this.favorites = []
      this.favoritesCollectionId = null
      this.activeUserId = null
      this.customModelId = null
    },
    async setCustomModelId(customModelId: string, targetUserId?: string) {
      if (customModelId === this.customModelId) return
      this.customModelId = customModelId
      // Replace results once loaded; keep current list visible while fetching
      await this.loadCreations(targetUserId, { reset: true, replace: true })
    },
    async clearCustomModelId(targetUserId?: string) {
      this.customModelId = null
      // Replace results once loaded; keep current list visible while fetching
      await this.loadCreations(targetUserId, { reset: true, replace: true })
    },
    async loadCreations(targetUserId?: string | null, opts?: { reset?: boolean; replace?: boolean }) {
      const userId = targetUserId

      // Build params and compute a query key for de-duplication
      const lastItem = opts?.reset ? undefined : this.creations[this.creations.length - 1]
      const params = {
        userId: userId || undefined,
        order: "desc" as const,
        endDateTime: lastItem?.createdAt?.toISOString(),
        limit: 20,
        customModelId: this.filter.model === "custom" ? this.customModelId || this.filter.customModelId : undefined,
        promptIncludes: this.search || undefined,
        aspectRatio: this.filter.aspectRatio as any,
        model: this.filter.model,
      }

      if (params.model == "custom" && !params.customModelId) {
        console.error("invalid custom query", this.customModelId, this.filter.customModelId)
        return
      }

      const queryKey = JSON.stringify(params)
      if (this.loadingCreations && this.lastQueryKey === queryKey) {
        return
      }

      this.loadingCreations = true
      this.lastQueryKey = queryKey
      try {
        // Set activeUserId to track which user's data we're loading
        this.activeUserId = userId || null

        const response = await creationsCreateImageRequests(params)

        const creations = response.data
        if (!creations) return
        if (opts?.replace) {
          // Replace the current list in one shot to avoid empty state between requests
          this.creations = creations.map((creation: any) => ({
            ...creation,
            type: "image",
            mediaIds: creation.imageIds,
            createdAt: new Date(creation.createdAt),
          }))
        } else {
          for (const creation of creations) {
            this.addItem({
              ...creation,
              createdAt: new Date(creation.createdAt),
            })
          }
        }
      } catch (err: any) {
        console.error("Error loading creations:", err)
        throw err
      } finally {
        this.loadingCreations = false
      }
    },
    async loadCreationsPage(userId?: string | null, page = 1, limit = 30) {
      // Direct page navigation using offset+limit
      // Resets current list to keep memory bounded when jumping far
      this.creations = []
      this.loadingCreations = true
      try {
        this.activeUserId = userId || null
        const params = {
          userId: userId || undefined,
          order: 'desc' as const,
          offset: Math.max(0, (page - 1) * limit),
          limit,
          promptIncludes: this.search || undefined,
          aspectRatio: this.filter.aspectRatio as any,
          model: this.filter.model,
          customModelId: this.filter.customModelId,
        }
        const response = await creationsCreateImageRequests(params)
        const creations = response.data
        if (!creations) return
        for (const creation of creations) {
          this.addItem({
            ...creation,
            createdAt: new Date(creation.createdAt),
          })
        }
      } finally {
        this.loadingCreations = false
      }
    },
    async loadPurchases(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      this.activeUserId = userId
      const lastItem = this.imagePurchases[this.imagePurchases.length - 1]

      try {
        const response = await creationsUserImagePurchases({
          userId,
          order: "desc",
          endDateTime: lastItem?.createdAt ? lastItem.createdAt : undefined,
          limit: 20,
        })

        const purchases = response.data

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

        const response = await collectionsGetCollectionImages({
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
    async generateImage(request: CreateImageRequestWithCustomModel) {
      const creatorId = useUserAuth().userId
      if (!creatorId) throw new Error("User not authenticated")
      if (!request.prompt) throw new Error("Prompt is required")
      if (typeof request.prompt !== "string") throw new Error("Prompt must be a string")

      const response = await createImage(request as CreateImageBody)
      const result = response.data

      if (!result) return
      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          Dialog.create({
            title: "Error",
            message: err,
            ok: true,
            color: "negative",
          })
        }
      }

      const createdItem: UnifiedRequest = {
        ...request,
        mediaIds: result.ids.reverse(),
        id: result.id,
        createdAt: new Date(),
        creatorId,
        creatorUsername: useUserAuth().userProfile?.username || "", // Add missing creatorUsername
        customModelId: request.customModelId,
        customModelName: request.customModelName,
        type: "image",
      }

      this.creations.unshift(createdItem)
    },
  },
  persist: false,
})
