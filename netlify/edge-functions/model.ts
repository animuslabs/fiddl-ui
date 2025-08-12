import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { modelsGetBaseModels, modelsGetModelByName, modelsGetPublicModels } from "./lib/orval.ts"
import { buildMediaEls, buildModelFooterHtml, buildModelMetadataInnerHtml, buildModelSchema, buildStaticTopNavHtml } from "./lib/util.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"
const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const [, , modelName, customModelId] = url.pathname.split("/")
    if (!modelName) return context.next()
    const [modelData, baseModels, publicModels] = await Promise.all([modelsGetModelByName({ name: modelName, customModelId, includeMedia: 20 }), modelsGetBaseModels().catch(() => null), modelsGetPublicModels().catch(() => null)])
    const isVideo = modelData.model.modelTags.some((t: string) => t.toLowerCase().includes("video"))
    const media = modelData.media || []
    const first = media[0]
    return await buildPageResponse({
      request,
      context,
      pageTitle: modelData.model.name + " Model | Fiddl.art",
      social: {
        description: modelData.model.description || "Create, share and earn with generative art on Fiddl.art.",
        imageUrl: first ? (isVideo ? s3Video(first.id, "thumbnail") : img(first.id, "lg")) : "https://app.fiddl.art/OGImage-1.jpg",
        twitterImageAlt: first?.meta ?? "",
        ogType: "website",
      },
      blocks: {
        jsonLd: [buildModelSchema(modelData, `${url.origin}${url.pathname}`)],
        htmlBlocks: [
          buildStaticTopNavHtml(),
          buildModelMetadataInnerHtml(modelData),
          buildMediaEls(media.map((m) => ({ ...m, type: isVideo ? "video" : "image" }))), //
          buildModelFooterHtml([...(baseModels ?? []), ...(publicModels ?? [])]),
        ],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "model", e)
    return context.next()
  }
  
  export default safeEdge(handler, "model")
}
