import type { Context } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { shortIdToLong } from "./lib/util.ts"
import { creationsGetImageRequest, creationsGetVideoRequest } from "./lib/orval.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"

export default async function (request: Request, context: Context) {
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

    const imageUrl = type === "video" ? s3Video(mediaId, "thumbnail") : img(mediaId, "md")

    return buildPageResponse({
      request,
      context,
      pageTitle: `Fiddl.art ${type === "video" ? "Video" : "Image"} Request`,
      social: {
        imageUrl,
        description: "View this AI-generated creation on Fiddl.art.",
        ogType: "website",
      },
    })
  } catch (e) {
    console.error("handleRequestPage error:", e)
    return context.next()
  }
}
