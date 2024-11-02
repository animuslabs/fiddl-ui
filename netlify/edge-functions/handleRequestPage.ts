import { Context } from "@netlify/edge-functions"
import { setSocialMetadata, shortIdToLong } from "./lib/util.ts"
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
  console.log(id)
  const longId = shortIdToLong(id)
  const requestData = await fetch(`https://api.fiddl.art/trpc/creations.createRequest?input="${encodeURIComponent(longId)}"`)
  // const requestData = await fetch(`http://localhost:4444/trpc/creations.createRequest?input="${encodeURIComponent(longId)}"`)
  const jsonData = await requestData.json()
  const images = jsonData.result.data.imageIds
  const imageId = images[url.searchParams.get("index") || 0]
  const imageUrl = `https://api.fiddl.art/images/${imageId}-md.webp`
  // const imageUrl = `http://localhost:4444/images/${imageId}-md.webp`
  const updatedHtml = setSocialMetadata(text, id || "image id", "A creation on Fiddl.art", imageUrl, url.toString(), "summary_large_image")
  return new Response(updatedHtml, response)
}
