import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildMediaEls, buildMediaListSchema, buildStaticTopNavHtml, renderJsonAsHtml, shortIdToLong, type MediaItem, buildAssetLicenseMetadata } from "./lib/util.ts"
import { creationsGetImageRequest, creationsGetVideoRequest, type CreationsGetVideoRequest200 } from "./lib/orval.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const [, , typeRaw, shortId, indexRaw] = url.pathname.split("/")
    if (!shortId) return context.next()

    const type = typeRaw === "video" ? "video" : "image"
    const index = Number(indexRaw || "0")

    // decode and validate shortId -> uuid
    let longId = ""
    try {
      longId = shortIdToLong(shortId)
    } catch (err) {
      logEdgeError(request, context, "request:shortIdDecodeError", { error: err, shortId })
      return context.next()
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRe.test(longId)) {
      logEdgeError(request, context, "request:invalidUuid", { shortId, longId })
      return context.next()
    }

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
      createdAt: data.createdAt,
    }))
    // Use per-media thumbnail for OG when type is video
    const imageUrl = type === "video" ? s3Video(mediaId, "thumbnail") : img(mediaId, "md")
    const pageUrl = `${url.origin}${url.pathname}`

    // Build SEO-friendly title and description
    const creator = data.creatorUsername ? `@${data.creatorUsername}` : ""
    const pageTitle = `A creation on Fiddl.art${creator ? ` by ${creator}` : ""} | ${shortId}`
    const metaSnippet = (data.meta || data.prompt || "").trim()
    const typePhrase = type === "video" ? "AI-generated video" : "AI-generated image"
    const description = `${metaSnippet ? `${metaSnippet} — ` : ""}${typePhrase}${creator ? ` by ${creator}` : ""} on Fiddl.art.`

    // Build a focused JSON-LD object for the specific media item to
    // help Google pick the correct thumbnailUrl for video indexing.
    const singleMediaJsonLd = (() => {
      if (type === "video") {
        const v = data as CreationsGetVideoRequest200
        const name = (v.meta || v.prompt || "AI-generated video").trim() || `Video ${index + 1}`
        const uploadDate = v.createdAt
        const durationSeconds = v.duration && Number.isFinite(v.duration) ? v.duration : undefined
        const durationIso = durationSeconds ? `PT${Math.round(durationSeconds)}S` : undefined
        const obj: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "@id": pageUrl,
          name,
          description: name,
          thumbnailUrl: s3Video(mediaId, "thumbnail"),
          contentUrl: s3Video(mediaId, "preview-lg"),
          uploadDate,
          ...(durationIso ? { duration: durationIso } : {}),
          ...(v.creatorUsername
            ? {
                creator: {
                  "@type": "Person",
                  name: v.creatorUsername,
                  url: `https://app.fiddl.art/@${v.creatorUsername}`,
                },
              }
            : {}),
          potentialAction: {
            "@type": "WatchAction",
            target: pageUrl,
          },
          ...buildAssetLicenseMetadata({ creatorUsername: v.creatorUsername, createdAt: v.createdAt }),
        }
        return JSON.stringify(obj)
      }
      // Image fallback (not the main focus of this change but kept consistent)
      const name = (data.meta || data.prompt || "AI-generated image").trim() || `Image ${index + 1}`
      return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ImageObject",
        "@id": pageUrl,
        name,
        description: name,
        contentUrl: img(mediaId, "lg"),
        ...buildAssetLicenseMetadata({ creatorUsername: data.creatorUsername, createdAt: data.createdAt }),
      })
    })()

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        imageUrl,
        description,
        twitterImageAlt: metaSnippet || undefined,
        ogType: type === "video" ? "video.other" : "website",
      },
      blocks: {
        title: pageTitle,
        jsonLd: [singleMediaJsonLd, buildMediaListSchema(medias, pageUrl)],
        htmlBlocks: [buildStaticTopNavHtml(), buildMediaEls(medias), renderJsonAsHtml(data, "Creation Request Metadata")],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "request", e)
    return context.next()
  }
}

export default safeEdge(handler, "request")

export const config: Config = {
  path: "/request/:type/:shortId/:index?",
}
