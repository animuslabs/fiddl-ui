import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { creationsBrowseCreateRequests } from "./lib/orval.ts"
import { buildStaticTopNavHtml, escapeHtml, buildMediaListSchema } from "./lib/util.ts"
import { img, s3Video } from "./lib/netlifyImg.ts"

interface BrowseRow {
  mediaType: "image" | "video"
  id: string
  createdAt: string
  aspectRatio: string
  media: { id: string }[] | null
  creatorUsername?: string
  prompt?: string
  model?: string
}

interface MediaItem {
  id: string
  url: string
  type: "image" | "video"
  aspectRatio?: number
  createdAt: Date
  creatorUsername?: string
  prompt?: string
  model?: string
}

function aspectRatioToNumber(raw?: string | null): number | undefined {
  if (!raw) return undefined
  if (raw.includes(":")) {
    const [w, h] = raw.split(":").map(parseFloat)
    return h && w ? w / h : undefined
  }
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

export default async function (request: Request, context: Context) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    // Extract filters from URL parameters
    const sortMethod = (searchParams.get("sort") as "latest" | "popular" | "shuffle") || "shuffle"
    const mediaType = (searchParams.get("type") as "image" | "video" | "all") || "all"
    const search = searchParams.get("search") || undefined
    const model = searchParams.get("model") || undefined
    const aspectRatio = searchParams.get("aspectRatio") || undefined

    // Fetch browse data (first page, 20 items for SSR)
    const response = await creationsBrowseCreateRequests({
      order: "desc",
      limit: 20,
      promptIncludes: search,
      aspectRatio: aspectRatio as any,
      model: model as any,
      randomSeed: sortMethod === "shuffle" ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : undefined,
      sortMethod,
      mediaType,
    })

    const browseRows = response as unknown as BrowseRow[]
    const mediaItems = processBrowseData(browseRows)

    const pageTitle = buildPageTitle(sortMethod, mediaType, search, model)
    const description = buildPageDescription(sortMethod, mediaType, search, model)

    return buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        description,
        imageUrl: mediaItems[0]?.url || "https://app.fiddl.art/OGImage-1.jpg",
        ogType: "website",
      },
      blocks: {
        jsonLd: [buildBrowseListSchema(mediaItems, `${url.origin}${url.pathname}`, { sortMethod, mediaType, search, model })],
        htmlBlocks: [buildStaticTopNavHtml(), buildBrowsePageHtml(mediaItems, { sortMethod, mediaType, search, model }), buildBrowseFiltersHtml()],
      },
    })
  } catch (e) {
    console.error("handleBrowsePage error:", e)
    return context.next()
  }
}

function processBrowseData(rows: BrowseRow[]): MediaItem[] {
  const mediaItems: MediaItem[] = []

  for (const row of rows) {
    // Normalize media to a proper array
    let medias: { id: string }[] = []

    if (Array.isArray(row.media)) {
      medias = row.media
    } else if (typeof row.media === "string") {
      try {
        const parsed = JSON.parse(row.media) as unknown
        if (Array.isArray(parsed)) medias = parsed as { id: string }[]
      } catch {
        /* ignore parse errors */
      }
    }

    if (medias.length === 0) continue

    const t = row.mediaType

    for (const m of medias) {
      if (mediaItems.find((e) => e.id === m.id)) continue

      const item: MediaItem = {
        id: m.id,
        url: t === "image" ? img(m.id, "lg") : s3Video(m.id, "preview-lg"),
        type: t,
        aspectRatio: aspectRatioToNumber(row.aspectRatio),
        createdAt: new Date(row.createdAt),
        creatorUsername: row.creatorUsername,
        prompt: row.prompt,
        model: row.model,
      }

      mediaItems.push(item)
    }
  }

  return mediaItems
}

function buildPageTitle(sortMethod: string, mediaType: string, search?: string, model?: string): string {
  let title = "Browse AI Creations"

  if (search) title = `"${search}" Creations`
  else if (model) title = `${model} Model Creations`
  else if (mediaType !== "all") title = `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} Creations`

  if (sortMethod === "popular") title += " - Most Popular"
  else if (sortMethod === "latest") title += " - Latest"

  return `${title} | Fiddl.art`
}

function buildPageDescription(sortMethod: string, mediaType: string, search?: string, model?: string): string {
  let description = "Discover amazing AI-generated creations on Fiddl.art. "

  if (search) description += `Search results for "${search}". `
  else if (model) description += `Browse creations made with the ${model} model. `
  else if (mediaType === "image") description += "Browse AI-generated images. "
  else if (mediaType === "video") description += "Browse AI-generated videos. "
  else description += "Browse both AI images and videos. "

  if (sortMethod === "popular") description += "Sorted by popularity."
  else if (sortMethod === "latest") description += "Showing the latest creations."
  else description += "Shuffled for discovery."

  return description
}

function buildBrowseListSchema(mediaItems: MediaItem[], pageUrl: string, filters: { sortMethod: string; mediaType: string; search?: string; model?: string }): string {
  const itemListElement = mediaItems.map((item, index) => {
    const mediaUrl = `https://app.fiddl.art/request/${item.type}/${item.id.slice(-8)}`

    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": item.type === "image" ? "ImageObject" : "VideoObject",
        "@id": mediaUrl,
        contentUrl: item.url,
        ...(item.type === "video" && { thumbnailUrl: s3Video(item.id, "thumbnail") }),
        name: item.prompt || `AI-generated ${item.type}`,
        description: item.prompt || `AI-generated ${item.type} created on Fiddl.art`,
        dateCreated: item.createdAt.toISOString(),
        ...(item.creatorUsername && {
          creator: {
            "@type": "Person",
            name: item.creatorUsername,
            url: `https://app.fiddl.art/@${item.creatorUsername}`,
          },
        }),
        ...(item.model && {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "model",
            value: item.model,
          },
        }),
        ...(item.aspectRatio && {
          width: Math.round(1000 * item.aspectRatio),
          height: 1000,
        }),
      },
    }
  })

  let listName = "AI Creations"
  if (filters.search) listName = `"${filters.search}" Search Results`
  else if (filters.model) listName = `${filters.model} Model Creations`
  else if (filters.mediaType !== "all") listName = `AI ${filters.mediaType.charAt(0).toUpperCase() + filters.mediaType.slice(1)}s`

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": pageUrl,
    name: listName,
    description: buildPageDescription(filters.sortMethod, filters.mediaType, filters.search, filters.model),
    url: pageUrl,
    numberOfItems: mediaItems.length,
    itemListElement,
    mainEntity: {
      "@type": "WebPage",
      "@id": pageUrl,
      name: "Browse AI Creations",
      description: "Browse AI-generated images and videos on Fiddl.art",
      isPartOf: {
        "@type": "WebSite",
        name: "Fiddl.art",
        url: "https://app.fiddl.art",
      },
    },
  }

  return JSON.stringify(schema)
}

function buildBrowsePageHtml(mediaItems: MediaItem[], filters: { sortMethod: string; mediaType: string; search?: string; model?: string }): string {
  const headerText = filters.search ? `Search Results for "${filters.search}"` : filters.model ? `${filters.model} Model Creations` : filters.mediaType !== "all" ? `AI ${filters.mediaType.charAt(0).toUpperCase() + filters.mediaType.slice(1)}s` : "Browse AI Creations"

  const itemCount = mediaItems.length

  const mediaHtml = mediaItems
    .map((item) => {
      const mediaUrl = `/request/${item.type}/${item.id.slice(-8)}`
      const authorLink = item.creatorUsername ? `<a href="/@${escapeHtml(item.creatorUsername)}" class="media-author">@${escapeHtml(item.creatorUsername)}</a>` : ""
      const promptText = item.prompt ? escapeHtml(item.prompt.slice(0, 100) + (item.prompt.length > 100 ? "..." : "")) : ""
      const modelInfo = item.model ? `<span class="media-model">Model: ${escapeHtml(item.model)}</span>` : ""

      const mediaElement =
        item.type === "image"
          ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.prompt || `AI-generated ${item.type}`)}" loading="lazy" />`
          : `<video src="${escapeHtml(item.url)}" poster="${escapeHtml(s3Video(item.id, "thumbnail"))}" loading="lazy" controls muted playsinline></video>`

      return `
      <div class="media-item" itemscope itemtype="https://schema.org/${item.type === "image" ? "ImageObject" : "VideoObject"}">
        <a href="${escapeHtml(mediaUrl)}" class="media-link">
          <div class="media-preview">
            ${mediaElement}
          </div>
          <div class="media-info">
            ${promptText ? `<p class="media-prompt" itemprop="description">${promptText}</p>` : ""}
            <div class="media-meta">
              ${authorLink}
              <span class="media-date" itemprop="dateCreated">${item.createdAt.toLocaleDateString()}</span>
            </div>
            ${modelInfo ? `<div class="media-footer">${modelInfo}</div>` : ""}
          </div>
        </a>
      </div>
    `
    })
    .join("")

  return `
    <div id="browse-page">
      <header class="browse-header">
        <h1>${escapeHtml(headerText)}</h1>
        <p class="browse-count">${itemCount} creations found</p>
        ${filters.sortMethod !== "shuffle" ? `<p class="browse-sort">Sorted by ${escapeHtml(filters.sortMethod)}</p>` : ""}
      </header>
      <div class="browse-grid">
        ${mediaHtml || '<p class="no-media">No creations found matching your criteria.</p>'}
      </div>
    </div>
  `
}

function buildBrowseFiltersHtml(): string {
  const sortOptions = [
    { value: "shuffle", label: "Shuffle" },
    { value: "latest", label: "Latest" },
    { value: "popular", label: "Popular" },
  ]

  const typeOptions = [
    { value: "all", label: "All Media" },
    { value: "image", label: "Images" },
    { value: "video", label: "Videos" },
  ]

  const sortHtml = sortOptions.map((option) => `<li><a href="/browse?sort=${escapeHtml(option.value)}">${escapeHtml(option.label)}</a></li>`).join("")

  const typeHtml = typeOptions.map((option) => `<li><a href="/browse?type=${escapeHtml(option.value)}">${escapeHtml(option.label)}</a></li>`).join("")

  return `
    <div id="browse-filters">
      <h2>Browse Options</h2>
      <div class="filters-grid">
        <div class="filter-group">
          <h3>Sort By</h3>
          <ul class="filter-list">
            ${sortHtml}
          </ul>
        </div>
        <div class="filter-group">
          <h3>Media Type</h3>
          <ul class="filter-list">
            ${typeHtml}
          </ul>
        </div>
      </div>
    </div>
  `
}

export const config: Config = {
  path: "/browse",
}
