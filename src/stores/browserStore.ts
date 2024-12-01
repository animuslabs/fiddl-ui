import { defineStore } from "pinia"
import api from "lib/api"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { pickRand, toObject } from "lib/util"
import { ratioRatings, type AspectRatio, type AspectRatioGrade, type ImageModel } from "lib/imageModels"

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
  creatorId: string
}

export const useBrowserStore = defineStore("browserStore", {
  state() {
    return {
      items: [] as BrowserItem[],
      loading: false,
      search: null as string | null,
      filter: {
        aspectRatio: undefined as AspectRatio | undefined,
        model: undefined as ImageModel | undefined,
      },
    }
  },
  getters: {
    reverse(): BrowserItem[] {
      return this.items.slice().reverse()
    },
    filterActive(): boolean {
      return !!this.filter.aspectRatio || !!this.filter.model
    },
  },
  actions: {
    deleteImage(imageId: string, requestId: string) {
      const item = this.items.find((item) => item.id === requestId)
      if (!item) return
      const index = item.imageIds.indexOf(imageId)
      if (index === -1) return
      item.imageIds.splice(index, 1)
    },
    resetFilters() {
      this.filter = {
        aspectRatio: undefined,
        model: undefined,
      }
    },
    searchCreations() {
      this.items = []
      void this.loadCreations()
    },
    addItem(item: BrowserItem) {
      const idExists = this.items.some((i) => i.id === item.id)
      if (idExists) return
      this.items.push(item)
    },
    reset() {
      console.log("reset", this.search)
      this.items = []
      void this.loadCreations()
      // const rev = this.reverse
    },
    async loadCreations() {
      this.loading = true
      const lastItem = this.items[this.items.length - 1]
      console.log("lastItem", lastItem?.createdAt)
      let endDateTime
      if (lastItem?.createdAt) {
        endDateTime = lastItem.createdAt
        // endDateTime.setSeconds(endDateTime.getSeconds() + 1)
      }
      const creations = await api.creations.browseCreateRequests.query({
        order: "desc",
        endDateTime: lastItem?.createdAt || undefined,
        limit: 100,
        promptIncludes: this.search?.length ? this.search : undefined,
        aspectRatio: this.filter.aspectRatio || undefined,
        model: this.filter.model || undefined,
      })
      console.log("creations", creations)
      for (const creation of creations as any) {
        this.addItem({
          id: creation.id,
          aspectRatio: creation.aspectRatio as AspectRatio,
          ratioGrade: ratioRatings[creation.aspectRatio as AspectRatio] || "square",
          cssClass: getImgClass(ratioRatings[creation.aspectRatio as AspectRatio]) || "small",
          imageIds: creation.images.map((el: any) => el.id),
          createdAt: new Date(creation.createdAt),
          creatorId: creation.user.id,
        })
      }
      this.loading = false
    },
    async loadRecentCreations() {
      this.loading = true
      const firstItem = this.items[0]
      let startDateTime
      if (firstItem?.createdAt) {
        startDateTime = firstItem.createdAt
      }
      const creations = await api.creations.browseCreateRequests.query({
        order: "asc",
        startDateTime: startDateTime || undefined,
        limit: 100,
        promptIncludes: this.search?.length ? this.search : undefined,
        aspectRatio: this.filter.aspectRatio || undefined,
        model: this.filter.model || undefined,
      })
      console.log("recent creations", creations)

      for (const creation of creations as any) {
        const newItem = {
          id: creation.id,
          aspectRatio: creation.aspectRatio as AspectRatio,
          ratioGrade: ratioRatings[creation.aspectRatio as AspectRatio] || "square",
          cssClass: getImgClass(ratioRatings[creation.aspectRatio as AspectRatio]) || "small",
          imageIds: creation.images.map((el: any) => el.id),
          createdAt: new Date(creation.createdAt),
          creatorId: creation.user.id,
        }

        // Check if the item already exists
        const exists = this.items.some((item) => item.id === newItem.id)
        if (!exists) {
          // Add the new item at the beginning
          this.items.unshift(newItem)
        }
      }
      this.loading = false
    },
  },
  persist: false,
})
