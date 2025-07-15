import { Context } from "@netlify/edge-functions"
import { normalizeCanonicalUrl, setSocialMetadata, shortIdToLong } from "./lib/util.ts"
import { creationsGetImageRequest, creationsGetVideoRequest } from "./lib/orval.ts"

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)
  const response = await context.next()
  const text = await response.text()
  const type = (url.searchParams.get("type") as "image" | "video") || "image"
  const index = parseInt(url.searchParams.get("index") || "0")
  // for (const [key] of url.searchParams) {
  //   if (key !== "index" || ) {
  //     url.searchParams.delete(key)
  //   }
  // }

  const segments = url.pathname.split("/")
  const id = segments[2]
  console.log("shortId:", id)
  if (!id) throw Error("id error")
  const longId = shortIdToLong(id)
  // const requestData = await fetch(`https://api.fiddl.art/trpc/creations.createRequest?input="${encodeURIComponent(longId)}"`)
  // const requestData = await fetch(`http://localhost:4444/trpc/creations.createRequest?input="${encodeURIComponent(longId)}"`)

  const requestData = type == "image" ? (await creationsGetImageRequest({ imageRequestId: longId })).data : (await creationsGetVideoRequest({ videoRequestId: longId })).data

  if ("code" in requestData) throw Error("request error:" + JSON.stringify(requestData, null, 2))
  const mediaIds = "imageIds" in requestData ? requestData.imageIds : requestData.videoIds
  const mediaId = mediaIds[index]
  const mediaUrl = type == "image" ? `https://api.fiddl.art/images/${mediaId}-md.webp` : `https://fiddl-art.sfo3.cdn.digitaloceanspaces.com/previewVideos/${mediaId}/thumbnail.webp`

  // const imageUrl = `http://localhost:4444/images/${imageId}-md.webp`
  const updatedHtml = setSocialMetadata(text, id, "A creation on Fiddl.art", mediaUrl, normalizeCanonicalUrl(url.toString(), ["type", "index"]), "summary_large_image")
  return new Response(updatedHtml, response)
}
