import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { createPinia, defineStore } from "pinia"
import { api } from "lib/api"
import { UserData } from "lib/types"
import { jwt } from "lib/jwt"
import { CreateImageRequest } from "app/../fiddl-server/src/lib/types/serverTypes"

export interface CreatedItem {
  id: string
  // url: string
  points: number
  request: CreateImageRequest
}

export const useCreateSession = defineStore("createSession", {
  state() {
    return {
      sessionItems: [] as CreatedItem[]
    }
  },
  actions: {
    async reset(){
      this.sessionItems = []
    },
    async generateImage(request:CreateImageRequest) {
      const result = await api.create.image(request)
      let createdItem:CreatedItem = {
        id: result.id,
        points: 0,
        request
      }
      this.sessionItems.unshift(createdItem)
    }
  },
  persist:true
})
