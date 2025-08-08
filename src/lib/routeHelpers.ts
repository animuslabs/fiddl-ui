import type { AnyModel, ImageModel, VideoModel } from "lib/imageModels"
import type { UnifiedRequest } from "lib/types"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useCreateVideoStore } from "src/stores/createVideoStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { useRouter } from "vue-router"

export function toCreatePage(request: Partial<UnifiedRequest> & { model: AnyModel; type: "image" | "video" }, router: ReturnType<typeof useRouter>) {
  if (request.type == "image") {
    const model = request.customModelId ? "custom" : (request.model as ImageModel) || "core"
    const customModelId = model === "custom" ? request.customModelId : undefined
    const customModelName = model === "custom" ? request.customModelName : undefined
    useCreateImageStore().setReq({ model, customModelId, customModelName })
    // useImageCreations().resetFilters()
    // useImageCreations().filter = { model: request.model as ImageModel, customModelId, aspectRatio: undefined }
    void router.push({ name: "create", params: { activeTab: "image" } })
  } else {
    useCreateVideoStore().setReq({ model: (request.model as VideoModel) || "veo-2" })
    void router.push({ name: "create", params: { activeTab: "video" } })
  }
}
