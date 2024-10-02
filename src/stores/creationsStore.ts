import { defineStore } from "pinia"
import api, { type ImagePurchase } from "lib/api"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { toObject } from "lib/util"
import { useUserAuth } from "src/stores/userAuth"

export interface CreatedItem {
  request: CreateImageRequest
  imageIds: string[]
  id: string
  createdAt: Date
}

export const useCreations = defineStore("creationsStore", {
  state() {
    return {
      creations: [] as CreatedItem[],
      imagePurchases: [] as ImagePurchase[],
    }
  },
  getters: {},
  actions: {
    addItem(item: CreatedItem) {
      const idExists = this.creations.some((i) => i.id === item.id)
      if (idExists) return
      this.creations.push(item)
    },
    reset() {
      this.creations = []
      // const rev = this.reverse
    },
    async loadCreations(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      const lastItem = this.creations[this.creations.length - 1]
      console.log("lastItem", lastItem)
      const creations = await api.creations.createRequests.query({
        userId,
        includeMetadata: true,
        order: "desc",
        endDateTime: lastItem?.createdAt || undefined,
        limit: 5,
      })
      console.log("creations", creations)
      for (const creation of creations) {
        const request: CreateImageRequest = {
          prompt: creation.prompt,
          aspectRatio: creation.aspectRatio as any,
          model: creation.model as any,
          public: creation.public,
          quantity: creation.quantity,
          negativePrompt: creation.negativePrompt || undefined,
        }

        this.addItem({ id: creation.id, imageIds: creation.images.map((el: any) => el.id), request, createdAt: new Date(creation.createdAt) })
      }
    },
    async loadPurchases(userId?: string) {
      if (!userId) userId = useUserAuth().userId || undefined
      if (!userId) return
      const lastItem = this.imagePurchases[this.imagePurchases.length - 1]
      console.log("lastItem", lastItem)
      const purchases = await api.creations.userImagePurchases.query({
        userId,
        includeMetadata: true,
        order: "desc",
        endDateTime: lastItem?.createdAt ? new Date(lastItem.createdAt) : undefined,
        limit: 15,
      })
      console.log("purchases", purchases)
      for (const purchase of purchases) {
        const idExists = this.imagePurchases.some((i) => i.id === purchase.id)
        if (!idExists) this.imagePurchases.push(purchase)
      }

      // this.addItem({ id: creation.id, imageIds: creation.images.map((el: any) => el.id), request, createdAt: new Date(creation.createdAt) })
    },
  },
  persist: false,
})
