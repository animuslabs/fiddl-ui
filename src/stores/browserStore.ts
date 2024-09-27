import { defineStore } from "pinia"
import api from "lib/api"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { pickRand, toObject } from "lib/util"
import { ratioRatings, type AspectRatio, type AspectRatioGrade } from "lib/imageModels"

function getImgClass(ratioGrade: AspectRatioGrade) {
  const squareSizes = ["small", "medium", "large"]
  if (ratioGrade == "square") return squareSizes[Math.floor(Math.random() * squareSizes.length)]
  const tallSizes = ["tall", "tall-lg"]
  const wideSizes = ["wide", "wide-lg"]
  if (ratioGrade == "tall") return pickRand(tallSizes)
  if (ratioGrade == "wide") return pickRand(wideSizes)
  return ratioGrade
}
export interface BrowserItem {
  imageIds: string[]
  id: string
  createdAt: Date
  aspectRatio: AspectRatio
  ratioGrade: AspectRatioGrade
  cssClass: string
}

export const useBrowserStore = defineStore("browserStore", {
  state() {
    return {
      items: [] as BrowserItem[],
    }
  },
  getters: {
    reverse(): BrowserItem[] {
      return this.items.slice().reverse()
    },
  },
  actions: {
    addItem(item: BrowserItem) {
      const idExists = this.items.some((i) => i.id === item.id)
      if (idExists) return
      this.items.push(item)
    },
    reset() {
      this.items = []
      // const rev = this.reverse
    },
    async loadCreations() {
      const lastItem = this.items[this.items.length - 1]
      console.log("lastItem", lastItem?.createdAt)

      const creations = await api.creations.browseCreateRequests.query({
        order: "desc",
        endDateTime: lastItem?.createdAt || undefined,
        limit: 35,
      })
      console.log("creations", creations)
      for (const creation of creations) {
        this.addItem({
          id: creation.id,
          aspectRatio: creation.aspectRatio as AspectRatio,
          ratioGrade: ratioRatings[creation.aspectRatio as AspectRatio] || "square",
          cssClass: getImgClass(ratioRatings[creation.aspectRatio as AspectRatio]) || "small",
          imageIds: creation.images.map((el: any) => el.id),
          createdAt: new Date(creation.created),
        })
      }
    },
  },
  persist: false,
})
