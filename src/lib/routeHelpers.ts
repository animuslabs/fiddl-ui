import type { AnyModel, ImageModel, VideoModel } from "lib/imageModels"
import type { UnifiedRequest } from "lib/types"
import type { RouteLocationRaw } from "vue-router"
import { useRouter } from "vue-router"

/**
 * Build a pure route location for the Create page without mutating any stores.
 * The Create page orchestrator will consume these params and initialize state.
 */
export function buildCreateRoute(request: Partial<UnifiedRequest> & { model: AnyModel; type: "image" | "video" }): RouteLocationRaw {
  if (request.type === "image") {
    const model = (request.customModelId ? "custom" : (request.model as ImageModel)) || "core"
    const query: Record<string, string> = { model }
    if (request.customModelId) query.customModelId = String(request.customModelId)
    if (request.customModelName) query.customModelName = String(request.customModelName)
    return { name: "create", params: { activeTab: "image" }, query }
  } else {
    const model = ((request.model as VideoModel) || "veo-2") as string
    const query: Record<string, string> = { model }
    return { name: "create", params: { activeTab: "video" }, query }
  }
}

/**
 * Backward-compatible helper that performs navigation only (no side-effects).
 */
export function toCreatePage(request: Partial<UnifiedRequest> & { model: AnyModel; type: "image" | "video" }, router: ReturnType<typeof useRouter>) {
  void router.push(buildCreateRoute(request))
}
