import { Context } from "@netlify/edge-functions"
import { setSocialMetadata, shortIdToLong, throwErr } from "../../src/lib/util"
import { creationsCreateRequest } from "../../src/lib/orval"

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)
  const response = await context.next()
  const text = await response.text()
  for (const [key] of url.searchParams) {
    if (key !== "index") {
      url.searchParams.delete(key)
    }
  }

  const segments = url.pathname.split("/")
  const id = segments[2]
  console.log("shortId:", id)
  if (!id) throwErr("missing id")
  const longId = shortIdToLong(id)
  // const requestData = await fetch(`https://api.fiddl.art/trpc/creations.createRequest?input="${encodeURIComponent(longId)}"`)
  // const requestData = await fetch(`http://localhost:4444/trpc/creations.createRequest?input="${encodeURIComponent(longId)}"`)
  const requestData = await creationsCreateRequest({ requestId: longId })
  const jsonData = requestData.data
  const images = jsonData.imageIds
  const imageId = images[url.searchParams.get("index") || 0]
  const imageUrl = `https://api.fiddl.art/images/${imageId}-md.webp`
  // const imageUrl = `http://localhost:4444/images/${imageId}-md.webp`
  const updatedHtml = setSocialMetadata(text, id || "image id", "A creation on Fiddl.art", imageUrl, url.toString(), "summary_large_image")
  return new Response(updatedHtml, response)
}
