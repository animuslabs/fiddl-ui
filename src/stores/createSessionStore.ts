import { defineStore } from "pinia"
import api from "lib/api"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { catchErr, toObject } from "lib/util"
import type { CreatedItem } from "lib/types"
import { useUserAuth } from "src/stores/userAuth"
import { Dialog } from "quasar"

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
    addItem(item: CreatedItem) {
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
      this.sessionItems.unshift(createdItem)
      console.log(this.sessionItems)
    },
  },
  persist: false,
})
