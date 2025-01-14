import type { ImageCreateRequest } from "lib/api"
import api from "lib/api"
import { shortIdToLong } from "lib/util"
import { defineStore } from "pinia"

export const useImageRequests = defineStore("imageRequests", {
  state() {
    return {
      imageRequests: {} as Record<string, ImageCreateRequest>,
    }
  },
  actions: {
    async loadRequest(shortId: string) {
      const longId = shortIdToLong(shortId)
      console.log("longId", longId)
      const request = await api.creations.createRequest.query(longId)
      console.log("Loaded request", request)
      this.imageRequests[shortId] = request
      console.log(this.imageRequests)
    },
    async getRequest(shortId: string) {
      // if (!this.imageRequests[shortId]) await this.loadRequest(shortId)
      await this.loadRequest(shortId)
      return this.imageRequests[shortId]
    },
  },
})
