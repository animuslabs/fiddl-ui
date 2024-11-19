// src/stores/creationsStore.ts

import { defineStore } from "pinia"
import api, { type ImagePurchase, type Image } from "lib/api"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { useUserAuth } from "src/stores/userAuth"
import type { CreatedItem } from "lib/types"
import { catchErr, toObject } from "lib/util"
import { Dialog } from "quasar"

export const useCreations = defineStore("creationsStore", {
  state: () => ({
    creations: [] as CreatedItem[],
    imagePurchases: [] as ImagePurchase[],
    favorites: [] as Image[],
    favoritesCollectionId: null as string | null,
    activeUserId: null as string | null,
    customModelId: null as string | null,
  }),
  actions: {
    addItem(item: CreatedItem) {
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
      this.activeUserId = userId
      const lastItem = this.creations[this.creations.length - 1]
      console.log("lastItem", lastItem)

      const creations = await api.creations.createRequests.query({
        userId,
        includeMetadata: true,
        order: "desc",
        endDateTime: lastItem?.createdAt || undefined,
        limit: 25,
        customModelId: this.customModelId || undefined,
      })
      console.log("creations", creations)

      for (const creation of creations) {
        const request: CreateImageRequest = {
          prompt: creation.prompt || "",
          aspectRatio: creation.aspectRatio as any,
          model: creation.model as any,
          public: creation.public,
          quantity: creation.quantity,
          negativePrompt: creation.negativePrompt || undefined,
          customModelId: creation.customModelId || undefined,
        }

        this.addItem({
          id: creation.id,
          imageIds: creation.imageIds,
          request,
          createdAt: new Date(creation.createdAt),
          creatorId: creation.creatorId,
          customModelId: creation.customModelId,
          customModelName: creation.customModelName,
        })
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
        limit: 25,
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
    async generateImage(request: CreateImageRequest) {
      const creatorId = useUserAuth().userId
      if (!creatorId) throw new Error("User not authenticated")
      const result = await api.create.image.mutate(request).catch(catchErr)
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
      const createdItem: CreatedItem = {
        imageIds: result.ids.reverse(),
        request: toObject(request),
        id: result.id,
        createdAt: new Date(),
        creatorId,
      }
      this.creations.unshift(createdItem)
      // console.log(this.sessionItems)
    },
  },
  persist: false,
})
