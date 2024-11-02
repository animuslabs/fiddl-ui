import { Context } from "@netlify/edge-functions"
import { setSocialMetadata } from "./lib/util.ts"
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
  const updatedHtml = setSocialMetadata(text, id || "image id", "My Description", "https://api.fiddl.art/images/07f9e0f4-cb76-4408-9ed4-7815781bd957-lg.webp", url.toString())
  return new Response(updatedHtml, response)
}
