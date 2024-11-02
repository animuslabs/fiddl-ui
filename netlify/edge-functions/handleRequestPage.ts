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
  const imageUrl = `https://api.fiddl.art/images/${shortIdToLong(id)}-md.webp`
  const updatedHtml = setSocialMetadata(text, id || "image id", "A creation on Fiddl.art", imageUrl, url.toString(), "summary_large_image")
  return new Response(updatedHtml, response)
}
