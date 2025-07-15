import { type CreationsGetImageRequest200, type CreationsGetVideoRequest200 } from "lib/orval"
import type { MediaType } from "lib/types"
import { getCreationRequest, shortIdToLong } from "lib/util"
import { defineStore } from "pinia"

export const useImageRequests = defineStore("imageRequests", {
  state() {
    return {
      imageRequests: {} as Record<string, CreationsGetImageRequest200>,
      videoRequests: {} as Record<string, CreationsGetVideoRequest200>,
    }
  },
  actions: {
    async loadRequest(shortId: string, type: MediaType = "image") {
      const longId = shortIdToLong(shortId)
      console.log("longId", longId)
      // const response = await creationsCreateRequest({ requestId: longId })
      const request = await getCreationRequest(longId, type as any)

      console.log("Loaded request", request)
      if ("imageIds" in request) this.imageRequests[shortId] = request
      else this.videoRequests[shortId] = request
      console.log(this.imageRequests)
    },
    async getRequest(shortId: string) {
      // if (!this.imageRequests[shortId]) await this.loadRequest(shortId)
      await this.loadRequest(shortId)
      return this.imageRequests[shortId]
    },
  },
})
