import { defineStore } from "pinia"
import api from "lib/api"
import { type CreateImageRequest, type CreateImageRequestData } from "../../../fiddl-server/dist/lib/types/serverTypes"
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
      const creatorId = useUserAuth().userId
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

      const createdItem: CreateImageRequestData = {
        ...request,
        imageIds: result.ids.reverse(),
        id: result.id,
        createdAt: new Date(),
        creatorId,
      }

      this.addItem(createdItem)
    },
  },
  persist: false,
})
