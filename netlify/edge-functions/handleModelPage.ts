import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { modelsGetBaseModels, modelsGetModelByName, modelsGetPublicModels } from "./lib/orval.ts"
import { buildMediaEls, buildModelFooterHtml, buildModelMetadataInnerHtml, buildModelSchema, buildStaticTopNavHtml } from "./lib/util.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"

export const config: Config = {
  path: "/model/:modelName/:customModelId?",
  cache: "manual",
}

export default async function (request: Request, context: Context) {
  try {
    const url = new URL(request.url)
    const [, , modelName, customModelId] = url.pathname.split("/")
    if (!modelName) return context.next()

    // Fetch data (only if not cached — buildPageResponse will cache final HTML)
    const [modelData, baseModels, publicModels] = await Promise.all([modelsGetModelByName({ name: modelName, customModelId, includeMedia: 20 }), modelsGetBaseModels().catch(() => null), modelsGetPublicModels().catch(() => null)])

    // Compose blocks
    const fullUrl = `${url.origin}${url.pathname}`
    const schemaJson = buildModelSchema(modelData, fullUrl)
    const metaHtml = buildModelMetadataInnerHtml(modelData)

    const isVideo = modelData.model.modelTags.some((t: string) => t.toLowerCase().includes("video"))
    const media = modelData.media || []
    const mediaHtml = buildMediaEls(media.map((m: any) => ({ ...m, type: isVideo ? "video" : "image" })))
    const footerHtml = buildModelFooterHtml([...(baseModels ?? []), ...(publicModels ?? [])])
    const topNavHtml = buildStaticTopNavHtml()

    const first = media[0]
    const ogImage = first ? (isVideo ? s3Video(first.id, "thumbnail") : img(first.id, "lg")) : "https://app.fiddl.art/OGImage-1.jpg"

    // Hand off to the master constructor
    return buildPageResponse({
      request,
      context,
      social: {
        title: `${modelData.model.name} Model | Fiddl.art`,
        description: modelData.model.description || "Create, share and earn with generative art on Fiddl.art.",
        imageUrl: ogImage,
        // canonical+ogUrl default to clean origin+pathname if omitted
        twitterImageAlt: first?.meta ?? "",
        ogType: "website",
      },
      blocks: {
        title: `${modelData.model.name} | Fiddl.art`,
        jsonLd: [schemaJson],
        htmlBlocks: [topNavHtml, metaHtml, mediaHtml, footerHtml],
      },
    })
  } catch (e) {
    console.error("handleModelPage error:", e)
    return context.next()
  }
}
