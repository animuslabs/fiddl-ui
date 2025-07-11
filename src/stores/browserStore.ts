import { defineStore } from "pinia"
import { creationsBrowseCreateRequests } from "src/lib/orval"
import { pickRand, toObject } from "lib/util"
import { ratioRatings, type AspectRatio, type AspectRatioGrade, type ImageModel } from "lib/imageModels"
import { SortMethod } from "fiddl-server/dist/lib/types/serverTypes"

export const sortMethodIcon: Record<SortMethod, string> = {
  latest: "sym_o_overview",
  popular: "star",
  shuffle: "shuffle",
}

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
  collections?: number
  purchases?: number
}

export const useBrowserStore = defineStore("browserStore", {
  state() {
    return {
      items: [] as BrowserItem[],
      loading: false,
      search: null as string | null,
      randomSeed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      filter: {
        aspectRatio: undefined as AspectRatio | undefined,
        model: undefined as ImageModel | undefined,
        sort: "shuffle" as SortMethod,
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
    setSort(method: SortMethod) {
      this.filter.sort = method
    },
    resetFilters() {
      this.filter = {
        aspectRatio: undefined,
        model: undefined,
        sort: "shuffle",
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
      }

      try {
        const response = await creationsBrowseCreateRequests({
          order: "desc",
          endDateTime: lastItem?.createdAt ? lastItem.createdAt.toISOString() : undefined,
          limit: 100,
          promptIncludes: this.search?.length ? this.search : undefined,
          aspectRatio: this.filter.aspectRatio || undefined,
          model: this.filter.model || undefined,
          randomSeed: this.filter.sort == "shuffle" ? this.randomSeed : undefined,
          sortMethod: this.filter.sort,
        })

        // Extract data from response
        const creations = response.data
        console.log("Full response:", response)
        console.log("Response data type:", typeof response.data)
        console.log("Is response.data an array?", Array.isArray(response.data))

        // Process the data (same as before)
        for (const creation of creations as any) {
          // console.log("Single creation object:", creation)
          // console.log("creations: ", creation.images[0]?._count)
          this.addItem({
            id: creation.id,
            aspectRatio: creation.aspectRatio as AspectRatio,
            ratioGrade: ratioRatings[creation.aspectRatio as AspectRatio] || "square",
            cssClass: getImgClass(ratioRatings[creation.aspectRatio as AspectRatio]) || "small",
            imageIds: creation.images.map((el: any) => el.id),
            createdAt: new Date(creation.createdAt),
            creatorId: creation.userId,
            collections: creation.images[0]?._count?.Collections || 0,
            purchases: creation.images[0]?._count?.ImagePurchases || 0,
          })
        }
      } catch (error) {
        console.error("Error loading creations:", error)
      } finally {
        this.loading = false
      }
    },
    async loadRecentCreations() {
      if (this.filter.sort != "latest") return
      this.loading = true
      const firstItem = this.items[0]
      let startDateTime
      if (firstItem?.createdAt) {
        startDateTime = firstItem.createdAt
      }

      try {
        // Replace tRPC call with direct call to creationsBrowseCreateRequests
        const response = await creationsBrowseCreateRequests({
          order: "asc",
          startDateTime: startDateTime ? startDateTime.toISOString() : undefined,
          limit: 100,
          promptIncludes: this.search?.length ? this.search : undefined,
          aspectRatio: this.filter.aspectRatio || undefined,
          model: this.filter.model || undefined,
          sortMethod: this.filter.sort,
        })

        // Extract data from response
        const creations = response.data
        console.log("recent creations", creations)

        // Process the data (same as before)
        for (const creation of creations as any) {
          const newItem = {
            id: creation.id,
            aspectRatio: creation.aspectRatio as AspectRatio,
            ratioGrade: ratioRatings[creation.aspectRatio as AspectRatio] || "square",
            cssClass: getImgClass(ratioRatings[creation.aspectRatio as AspectRatio]) || "small",
            imageIds: creation.images.map((el: any) => el.id),
            createdAt: new Date(creation.createdAt),
            creatorId: creation.user.id,
            collections: creation._count.Collections,
          }

          // Check if the item already exists
          const exists = this.items.some((item) => item.id === newItem.id)
          if (!exists) {
            // Add the new item at the beginning
            this.items.unshift(newItem)
          }
        }
      } catch (error) {
        console.error("Error loading recent creations:", error)
      } finally {
        this.loading = false
      }
    },
  },
  persist: false,
})
