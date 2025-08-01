import type { Context, Config } from "@netlify/edge-functions"
import { modelsGetBaseModels, modelsGetModelByName, modelsGetPublicModels } from "./lib/orval.ts"
import { buildMediaEls, buildModelFooterHtml, buildModelMetadataInnerHtml, buildModelSchema, buildStaticTopNavHtml, setSocialMetadata, updateLinkTag } from "./lib/util.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"

export const config: Config = {
  path: "/model/:modelName/:customModelId?",
  cache: "manual",
}

export default async (request: Request, _context: Context) => {
  const context = _context as Context & {
    cache: {
      get(key: string): Promise<Response | undefined>
      set(key: string, value: Response, ttl?: number): Promise<void>
    }
  }
  try {
    const url = new URL(request.url)
    const segments = url.pathname.split("/")
    const modelName = segments[2]
    const customModelId = segments[3] || undefined
    const cacheKey = `model-page:${modelName}:${customModelId || "base"}`
    if (!modelName) return context.next()

    const cached = await context.cache?.get?.(cacheKey)
    if (cached) return cached
    console.log("Cache miss for model page:", cacheKey)
    const [res, modelData, baseModels, publicModels] = await Promise.all([context.next(), modelsGetModelByName({ name: modelName, customModelId, includeMedia: 20 }), modelsGetBaseModels().catch(console.error), modelsGetPublicModels().catch(console.error)])
    const allModels = [...(baseModels || []), ...(publicModels || [])]
    const modelNavHtml = buildModelFooterHtml(allModels)
    const html = await res.text()
    const fullUrl = `${url.origin}${url.pathname}`
    const schemaJson = buildModelSchema(modelData, fullUrl)
    const metadataHtml = buildModelMetadataInnerHtml(modelData)
    const type = modelData.model.modelTags.some((tag) => tag.toLowerCase().includes("video")) ? "video" : "image"
    const media = modelData.media || []
    const firstMedia = media[0]
    const mediaHtml = buildMediaEls(media.map((m) => ({ ...m, type })))
    const ssrBlock = `<div class="ssr-metadata">${buildStaticTopNavHtml()}\n${metadataHtml}\n${mediaHtml}\n${modelNavHtml}</div>`
    // console.log("First Media:", modelData)
    const ogTitle = `${modelData.model.name} Model | Fiddl.art`
    const ogDescription = modelData.model.description || "Create, share and earn with generative art on Fiddl.art."
    const ogImage = firstMedia ? (type == "video" ? s3Video(firstMedia.id, "thumbnail") : img(firstMedia.id, "lg")) : "https://app.fiddl.art/OGImage-1.jpg"
    const modelPath = `/model/${modelName}${customModelId ? `/${customModelId}` : ""}`
    const canonicalUrl = `${url.origin}${modelPath}`

    let modified = html.replace(/<title>.*?<\/title>/i, `<title>${modelData.model.name} | Fiddl.art</title>`).replace(/<head([^>]*)>/i, `<head$1>\n<script type="application/ld+json">${schemaJson}</script>`)
    modified = modified.replace(/<body([^>]*)>/i, `<body$1>\n${ssrBlock}`)
    modified = setSocialMetadata(modified, ogTitle, ogDescription, ogImage, canonicalUrl, "summary_large_image")
    // Cache the final response
    const response = new Response(modified, {
      status: res.status,
      headers: {
        //@ts-ignore
        ...Object.fromEntries(res.headers.entries()),

        "Cache-Control": "public, s-maxage=3600",
        "Content-Type": "text/html",
      },
    })

    if (context.cache?.set) await context.cache.set(cacheKey, response.clone(), 3600)
    return response
  } catch (error) {
    console.error("Error in modelsPage edge function:", error)
    return context.next()
  }
}
