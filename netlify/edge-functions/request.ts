import type { Context } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildMediaEls, buildMediaListSchema, buildStaticTopNavHtml, renderJsonAsHtml, shortIdToLong, type MediaItem } from "./lib/util.ts"
import { creationsGetImageRequest, creationsGetVideoRequest } from "./lib/orval.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const [, , typeRaw, shortId, indexRaw] = url.pathname.split("/")
    if (!shortId) return context.next()

    const type = typeRaw === "video" ? "video" : "image"
    const index = Number(indexRaw || "0")
    const longId = shortIdToLong(shortId)

    const data = type === "video" ? await creationsGetVideoRequest({ videoRequestId: longId }) : await creationsGetImageRequest({ imageRequestId: longId })

    if (!data || "code" in data) throw new Error("Invalid request")

    const ids = "videoIds" in data ? data.videoIds : data.imageIds
    const mediaId = ids?.[index]
    if (!mediaId) throw new Error("No media found")
    const medias: MediaItem[] = ids.map((id, i) => ({
      id,
      meta: `Media Index ${i} | ${data.meta || ""}`,
      type,
      creatorUsername: data.creatorUsername,
    }))
    const imageUrl = type === "video" ? s3Video(mediaId, "thumbnail") : img(mediaId, "md")
    const pageUrl = `${url.origin}${url.pathname}`
    return await buildPageResponse({
      request,
      context,
      pageTitle: `Fiddl.art ${type === "video" ? "Video" : "Image"} Request: ${shortId}`,
      social: {
        imageUrl,
        description: `View this creation ${data.creatorUsername ? "by @" + data.creatorUsername : ""} on Fiddl.art.`,
        ogType: type === "video" ? "video.other" : "website",
      },
      blocks: {
        jsonLd: [buildMediaListSchema(medias, pageUrl)],
        htmlBlocks: [buildStaticTopNavHtml(), buildMediaEls(medias), renderJsonAsHtml(data, "Creation Request Metadata")],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "request", e)
    return context.next()
  }
  
  export default safeEdge(handler, "request")
}
