import type { Context, Config } from "@netlify/edge-functions"
import { modelsGetBaseModels, modelsGetModelByName, modelsGetPublicModels } from "./lib/orval.ts"
import { buildMediaEls, buildModelFooterHtml, buildModelMetadataInnerHtml, buildModelSchema, buildStaticTopNavHtml } from "./lib/util.ts"

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

    const [res, modelData, baseModels, publicModels] = await Promise.all([context.next(), modelsGetModelByName({ name: modelName, customModelId, includeMedia: 20 }), modelsGetBaseModels().catch(console.error), modelsGetPublicModels().catch(console.error)])
    const allModels = [...(baseModels || []), ...(publicModels || [])]
    const modelNavHtml = buildModelFooterHtml(allModels)
    const html = await res.text()
    // Build schema and HTML metadata
    const fullUrl = `${url.origin}${url.pathname}`
    const schemaJson = buildModelSchema(modelData, fullUrl)
    const metadataHtml = buildModelMetadataInnerHtml(modelData)
    const mediaHtml = buildMediaEls(
      (modelData.media || []).map((m) => ({
        ...m,
        type: modelData.model.modelTags.some((tag) => tag.toLowerCase().includes("video")) ? "video" : "image",
      })),
    )
    const ssrBlock = `<div class="ssr-metadata">${buildStaticTopNavHtml()}\n${metadataHtml}\n${mediaHtml}\n${modelNavHtml}</div>`

    // Inject metadata into <head>
    let modified = html.replace(/<title>.*?<\/title>/i, `<title>${modelData.model.name} | Fiddl.art</title>`).replace(/<head([^>]*)>/i, `<head$1>\n<script type="application/ld+json">${schemaJson}</script>`)

    // Inject crawlable HTML into <body>
    modified = modified.replace(/<body([^>]*)>/i, `<body$1>\n${ssrBlock}`)

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
