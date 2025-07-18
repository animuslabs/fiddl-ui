import type { MediaType } from "lib/types"
import { reactive } from "vue"

export const createCardStore = reactive({
  activeTab: "image" as MediaType,
})
