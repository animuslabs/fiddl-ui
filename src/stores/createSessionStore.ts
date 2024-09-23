import { defineStore } from "pinia"
import api from "lib/api"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { toObject } from "lib/util"

export interface CreatedItem {
  request: CreateImageRequest
  imageIds: string[]
  id: string
}

export const useCreateSession = defineStore("createSession", {
  state() {
    return {
      sessionItems: [] as CreatedItem[],
    }
  },
  getters: {
    reverse(): CreatedItem[] {
      return this.sessionItems.slice().reverse()
    },
  },
  actions: {
    async reset() {
      this.sessionItems = []
      // const rev = this.reverse
    },
    async generateImage(request: CreateImageRequest) {
      const result = await api.create.image.mutate(request)
      const createdItem: CreatedItem = {
        imageIds: result.ids,
        request: toObject(request),
        id: result.id,
      }
      this.sessionItems.unshift(createdItem)
      console.log(this.sessionItems)
    },
  },
  persist: false,
})
