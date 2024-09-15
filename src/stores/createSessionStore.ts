import { defineStore } from "pinia"
import { api } from "lib/api"
import { CreateImageRequest } from "app/../fiddl-server/src/lib/types/serverTypes"

export interface CreatedItem {
  id: string
  // url: string
  points: number
  request: CreateImageRequest
}

function requestMatches(request: CreateImageRequest, other: CreateImageRequest) {
  return request.prompt === other.prompt && request.quantity === other.quantity && request.seed === other.seed && request.model === other.model && request.style === other.style
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
      const result = await api.create.image(request)
      const createdItem: CreatedItem = {
        id: result.id,
        points: 0,
        request,
      }
      this.sessionItems.unshift(createdItem)
    },
  },
  persist: false,
})
