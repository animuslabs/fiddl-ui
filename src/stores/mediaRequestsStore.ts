import { type CreationsGetImageRequest200, type CreationsGetVideoRequest200 } from "lib/orval"
import { type MediaType, type UnifiedRequest } from "lib/types"
import { getCreationRequest, shortIdToLong } from "lib/util"
import { defineStore } from "pinia"

export const useMediaRequests = defineStore("mediaRequests", {
  state() {
    return {
      requests: {} as Record<string, UnifiedRequest>,
    }
  },
  actions: {
    async loadRequest(shortId: string, type: MediaType = "image") {
      const longId = shortIdToLong(shortId)
      console.log("longId", longId)
      const request = await getCreationRequest(longId, type as any)
      console.log("Loaded request", request)
      this.requests[shortId] = request
    },
    async getRequest(shortId: string, type: MediaType, force: boolean = false): Promise<UnifiedRequest> {
      const val = this.requests[shortId]
      if (!force && val) return val
      await this.loadRequest(shortId, type)
      return this.getRequest(shortId, type)
    },
  },
})
