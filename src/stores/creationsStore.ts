// src/stores/creationsStore.ts

import { defineStore } from "pinia"
import api, { type ImagePurchase, type Image } from "lib/api"
import { CreateImageRequest, CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import { useUserAuth } from "src/stores/userAuth"
import { catchErr, toObject } from "lib/util"
import { Dialog } from "quasar"
import type { CreateImageRequestWithCustomModel } from "src/stores/createCardStore"
import type { AspectRatio, ImageModel } from "lib/imageModels"

export const useCreations = defineStore("creationsStore", {
  state: () => ({
    creations: [] as CreateImageRequestData[],
    imagePurchases: [] as ImagePurchase[],
    favorites: [] as Image[],
    favoritesCollectionId: null as string | null,
    activeUserId: null as string | null,
    customModelId: null as string | null,
    search: null as string | null,
    loadingCreations: false,
    dynamicModel: true,
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
    searchCreations() {
      this.creations = []
      void this.loadCreations()
    },
    deleteCreation(creationId: string) {
      const index = this.creations.findIndex((i) => i.id === creationId)
      if (index === -1) return
      this.creations.splice(index, 1)
    },
    deleteImage(imageId: string, creationId: string) {
      const creation = this.creations.find((i) => i.id === creationId)
      if (!creation) return
      const index = creation.imageIds.findIndex((id) => id === imageId)
      console.log("deleted image index", index)
      if (index === -1) return
      creation.imageIds.splice(index, 1)
    },
    addItem(item: CreateImageRequestData) {
      const idExists = this.creations.some((i) => i.id === item.id)
      if (idExists) return
      this.creations.push(item)
    },
    reset() {
      this.creations = []
      this.imagePurchases = []
      this.favorites = []
      this.favoritesCollectionId = null
      this.activeUserId = null
      this.customModelId = null
      this.resetFilters()

      void this.loadCreations()
    },
    async setCustomModelId(customModelId: string) {
      if (customModelId === this.customModelId) return
      this.customModelId = customModelId
      this.creations = []
      await this.loadCreations()
    },
    async clearCustomModelId() {
      this.customModelId = null
      this.creations = []
      await this.loadCreations()
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
        console.log("lastItem", lastItem)
        console.log("customModelId", this.customModelId || this.filter.customModelId)
        const creations = await api.creations.createRequests.query({
          userId,
          includeMetadata: true,
          order: "desc",
          endDateTime: lastItem?.createdAt || undefined,
          limit: 100,
          customModelId: this.filter.model == "custom" ? this.customModelId || this.filter.customModelId || undefined : undefined,
          promptIncludes: this.search?.length ? this.search : undefined,
          aspectRatio: this.filter.aspectRatio || undefined,
          model: this.filter.model || undefined,
        })
        console.log("creations", creations)

        for (const creation of creations) {
          this.addItem({
            ...creation,
            createdAt: new Date(creation.createdAt),
          })
        }
        this.loadingCreations = false
      } catch (err: any) {
        this.loadingCreations = false
        throw err
      }
    },
    async loadPurchases(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      this.activeUserId = userId
      const lastItem = this.imagePurchases[this.imagePurchases.length - 1]
      console.log("lastItem", lastItem)
      const purchases = await api.creations.userImagePurchases.query({
        userId,
        includeMetadata: true,
        order: "desc",
        endDateTime: lastItem?.createdAt ? new Date(lastItem.createdAt) : undefined,
        limit: 100,
      })
      console.log("purchases", purchases)
      for (const purchase of purchases) {
        const idExists = this.imagePurchases.some((i) => i.id === purchase.id)
        if (!idExists) this.imagePurchases.push(purchase)
      }
    },
    async loadFavorites(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      if (this.activeUserId !== userId) this.favoritesCollectionId = null
      this.activeUserId = userId
      if (!this.favoritesCollectionId) {
        const collection = await api.collections.findCollectionByName.query({
          collectionName: "likes",
          ownerId: userId,
        })
        this.favoritesCollectionId = collection?.id || null
      }
      if (!this.favoritesCollectionId) return
      this.favorites = (await api.collections.getCollectionImages.query(this.favoritesCollectionId)).reverse()
    },
    async generateImage(request: CreateImageRequestWithCustomModel) {
      const creatorId = useUserAuth().userId
      if (!creatorId) throw new Error("User not authenticated")
      if (!request.prompt) throw new Error("Prompt is required")
      if (typeof request.prompt !== "string") throw new Error("Prompt must be a string")
      const result = await api.create.image.mutate(request as any).catch(catchErr)
      if (!result) return
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          Dialog.create({
            title: "Error",
            message: err,
            ok: true,
            color: "negative",
          })
        }
      }
      const createdItem: CreateImageRequestData = {
        ...request,
        imageIds: result.ids.reverse(),
        id: result.id,
        createdAt: new Date(),
        creatorId,
        customModelId: request.customModelId,
        customModelName: request.customModelName,
      }
      this.creations.unshift(createdItem)
    },
  },
  persist: false,
})
