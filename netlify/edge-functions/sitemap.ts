import type { Context } from "@netlify/edge-functions"
import { creationsGetMediaRequests } from "./lib/orval.ts"
import { longIdToShort } from "./lib/util.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"
import { safeEdge } from "./lib/safe.ts"

const xml = (strings: TemplateStringsArray, ...values: any[]) =>
  strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "")

function esc(s: string | undefined | null): string {
  if (!s) return ""
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

async function sitemapIndex(origin: string): Promise<Response> {
  const body = xml`
    <?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>${origin}/sitemap-static.xml</loc></sitemap>
      <sitemap><loc>${origin}/sitemap-requests-images.xml</loc></sitemap>
      <sitemap><loc>${origin}/sitemap-requests-videos.xml</loc></sitemap>
    </sitemapindex>
  `.trim()
  return new Response(body, { status: 200, headers: headers() })
}

function headers(): Headers {
  const h = new Headers()
  h.set("Content-Type", "application/xml; charset=utf-8")
  // Cache aggressively on CDN, revalidate occasionally
  h.set("Cache-Control", "max-age=0, must-revalidate")
  h.set("Netlify-CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=300")
  return h
}

async function sitemapStatic(origin: string): Promise<Response> {
  const now = new Date().toISOString()
  const body = xml`
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>${origin}</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>
      <url><loc>${origin}/browse</loc><lastmod>${now}</lastmod><priority>0.9</priority></url>
      <url><loc>${origin}/models</loc><lastmod>${now}</lastmod><priority>0.9</priority></url>
      <url><loc>${origin}/create</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>
      <url><loc>${origin}/forge</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>
      <url><loc>${origin}/missions</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>
      <url><loc>${origin}/events</loc><lastmod>${now}</lastmod><priority>0.7</priority></url>
      <url><loc>${origin}/claim</loc><lastmod>${now}</lastmod><priority>0.7</priority></url>
    </urlset>
  `.trim()
  return new Response(body, { status: 200, headers: headers() })
}

async function sitemapRequestsImages(origin: string): Promise<Response> {
  // Fetch latest public media requests (images)
  const items = await creationsGetMediaRequests({ limit: 500, order: "desc" })
  const images = (items || []).filter((i: any) => i.mediaType === "image" && i.public)

  const urls = images.map((req: any) => {
    const sid = longIdToShort(req.id)
    const page = `${origin}/request/image/${sid}/0`
    const imgTags = (req.imageIds || []).slice(0, 12).map((id: string) => {
      const loc = img(id, "lg")
      const title = esc(req.meta || req.prompt || `Fiddl.art image ${id}`)
      const caption = esc(req.meta || req.prompt || "")
      return xml`<image:image>
        <image:loc>${loc}</image:loc>
        ${title ? xml`<image:title>${title}</image:title>` : ""}
        ${caption ? xml`<image:caption>${caption}</image:caption>` : ""}
      </image:image>`
    }).join("")
    const lastmod = esc(req.createdAt)
    return xml`<url>
      <loc>${page}</loc>
      ${lastmod ? xml`<lastmod>${lastmod}</lastmod>` : ""}
      ${imgTags}
    </url>`
  }).join("")

  const body = xml`<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    ${urls}
  </urlset>`

  return new Response(body, { status: 200, headers: headers() })
}

async function sitemapRequestsVideos(origin: string): Promise<Response> {
  const items = await creationsGetMediaRequests({ limit: 300, order: "desc" })
  const videos = (items || []).filter((i: any) => i.mediaType === "video" && i.public)

  const urls = videos.map((req: any) => {
    const sid = longIdToShort(req.id)
    const page = `${origin}/request/video/${sid}/0`
    const videoTags = (req.videoIds || []).slice(0, 8).map((id: string) => {
      const contentLoc = s3Video(id, "preview-lg")
      const thumbLoc = s3Video(id, "thumbnail")
      const title = esc(req.meta || req.prompt || `Fiddl.art video ${id}`)
      const description = esc(req.meta || req.prompt || "AI generated video on Fiddl.art")
      return xml`<video:video>
        <video:thumbnail_loc>${thumbLoc}</video:thumbnail_loc>
        <video:title>${title}</video:title>
        <video:description>${description}</video:description>
        <video:content_loc>${contentLoc}</video:content_loc>
      </video:video>`
    }).join("")
    const lastmod = esc(req.createdAt)
    return xml`<url>
      <loc>${page}</loc>
      ${lastmod ? xml`<lastmod>${lastmod}</lastmod>` : ""}
      ${videoTags}
    </url>`
  }).join("")

  const body = xml`<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
    ${urls}
  </urlset>`

  return new Response(body, { status: 200, headers: headers() })
}

const handler = async (request: Request, _context: Context) => {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  if (url.pathname === "/sitemap.xml") return sitemapIndex(origin)
  if (url.pathname === "/sitemap-static.xml") return sitemapStatic(origin)
  if (url.pathname === "/sitemap-requests-images.xml") return sitemapRequestsImages(origin)
  if (url.pathname === "/sitemap-requests-videos.xml") return sitemapRequestsVideos(origin)

  return new Response("Not Found", { status: 404 })
}

export default safeEdge(handler, "sitemap")
