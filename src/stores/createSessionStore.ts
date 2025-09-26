// @ts-nocheck
import { defineStore } from "pinia"
import { type CreateImageRequest, type CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import { catchErr, toObject } from "lib/util"
import { useUserAuth } from "src/stores/userAuth"
import { Dialog } from "quasar"
import { createImage, type CreateImageBody } from "lib/orval"

export const useCreateSession = defineStore("createSession", {
  state() {
    return {
      sessionItems: [] as CreateImageRequestData[],
    }
  },
  getters: {
    reverse(): CreateImageRequestData[] {
      return this.sessionItems.slice().reverse()
    },
  },
  actions: {
    deleteItem(id: string) {
      const index = this.sessionItems.findIndex((i) => i.id === id)
      if (index < 0) return
      this.sessionItems.splice(index, 1)
    },
    addItem(item: CreateImageRequestData) {
      const idExists = this.sessionItems.some((i) => i.id === item.id)
      if (idExists) return
      this.sessionItems.push(item)
    },
    reset() {
      this.sessionItems = []
      // const rev = this.reverse
    },
    async generateImage(request: CreateImageRequest) {
      const userAuth = useUserAuth()
      const creatorId = userAuth.userId
      if (!creatorId) throw new Error("User not authenticated")

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

      const imageIds = [...result.ids].reverse()
      const createdItem: CreateImageRequestData = {
        ...request,
        imageIds,
        images: imageIds.map((id) => ({ id, nsfw: false })),
        id: result.id,
        createdAt: new Date(),
        public: request.public ?? true,
        aspectRatio: request.aspectRatio ?? "1:1",
        quantity: request.quantity,
        creatorId,
        creatorUsername: userAuth.userProfile?.username || "",
        model: request.model,
        seed: request.seed,
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        customModelId: request.customModelId,
      }

      this.addItem(createdItem)
    },
  },
  persist: false,
})
