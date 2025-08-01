import { img, s3Video } from "./netlifyImg.ts"
import type { ModelsGetPublicModels200Item, ModelsGetBaseModels200Item, ModelsGetModelByName200, ModelsGetModelByName200MediaItem } from "./orval.ts"

export const updateLinkTag = (html: string, rel: string, href: string): string => {
  const linkTagRegex = new RegExp(`<link\\s[^>]*rel=["']${rel}["'][^>]*>`, "i")
  const newLinkTag = `<link rel="${rel}" href="${href}" />`

  if (linkTagRegex.test(html)) {
    return html.replace(linkTagRegex, newLinkTag)
  } else {
    return html.replace(/<\/head>/i, `  ${newLinkTag}\n</head>`)
  }
}

export function escapeHtml(input: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }

  return input.replace(/[&<>"']/g, (char) => map[char!]!)
}
type TwitterCardType = "summary" | "summary_large_image" | "player" | "app"

/**
 * Replace *all* existing OG / Twitter / canonical tags and insert a fresh set.
 */
export function setSocialMetadata(html: string, title: string, description: string, imageUrl: string, canonicalUrl: string, twitterCard: TwitterCardType = "summary_large_image"): string {
  // 1 — remove any existing OG, Twitter, or canonical tags (case-insensitive)
  html = html
    // remove <meta property="og:*" ...>  OR  <meta name="twitter:*" ...>
    .replace(/<meta\s+[^>]*?(property|name)=["']?(og:[^"']+|twitter:[^"']+)["'][^>]*?>/gi, "")
    // remove <link rel="canonical" ...>
    .replace(/<link\s+[^>]*?rel=["']?canonical["'][^>]*?>/gi, "")

  // 2 — build the new tag block
  const tags = [
    `<meta property="og:title"         content="${escapeAttr(title)}">`,
    `<meta property="og:description"   content="${escapeAttr(description)}">`,
    `<meta property="og:image"         content="${escapeAttr(imageUrl)}">`,
    `<meta property="og:url"           content="${escapeAttr(canonicalUrl)}">`,

    `<meta name="twitter:card"         content="${escapeAttr(twitterCard)}">`,
    `<meta name="twitter:title"        content="${escapeAttr(title)}">`,
    `<meta name="twitter:description"  content="${escapeAttr(description)}">`,
    `<meta name="twitter:image"        content="${escapeAttr(imageUrl)}">`,

    `<link rel="canonical"             href="${escapeAttr(canonicalUrl)}">`,
  ].join("\n  ")

  // 3 — insert just before </head>
  return html.replace(/<\/head>/i, `  ${tags}\n</head>`)
}

/* ────────── helpers ────────── */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function shortIdToLong(base64url: string): string {
  // Convert Base64 URL encoding to standard Base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  // Pad the Base64 string to make its length a multiple of 4
  const paddingNeeded = (4 - (base64.length % 4)) % 4
  base64 += "=".repeat(paddingNeeded)
  // Decode the Base64 string to an ArrayBuffer
  const buffer = base64ToArrayBuffer(base64)
  const bytes = new Uint8Array(buffer)
  // Convert the byte array to a hex string
  let hexStr = ""
  for (let i = 0; i < bytes.length; i++) {
    //@ts-ignore
    hexStr += bytes[i].toString(16).padStart(2, "0")
  }
  // Re-insert hyphens to format it as a UUID
  const uuid = `${hexStr.substr(0, 8)}-${hexStr.substr(8, 4)}-${hexStr.substr(12, 4)}-${hexStr.substr(16, 4)}-${hexStr.substr(20)}`
  return uuid
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const baseUrl = "https://api.fiddl.art/api"
  const res = await fetch(`${baseUrl}${url}`, options)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const normalizeCanonicalUrl = (url: string, keep: string[] = []): string => {
  const parsed = new URL(url)
  const filteredParams = new URLSearchParams()
  for (const param of keep) {
    const val = parsed.searchParams.get(param)
    if (val !== null) filteredParams.set(param, val)
  }
  parsed.search = filteredParams.toString()
  return parsed.toString()
}
export function buildModelSchema(data: ModelsGetModelByName200, fullUrl: string): string {
  const { model, media, customModelCreator } = data

  const isVideo = model.modelTags.some((tag) => tag.toLowerCase().includes("video"))
  const isImage = model.modelTags.some((tag) => tag.toLowerCase().includes("image"))
  const type: "video" | "image" = isVideo && !isImage ? "video" : "image"

  const mediaObjects =
    media?.slice(0, 10).map((item: ModelsGetModelByName200MediaItem) => {
      const contentUrl = type === "image" ? img(item.id, "lg") : s3Video(item.id, "preview-lg")
      const thumbnailUrl = s3Video(item.id, "thumbnail")

      const base = {
        "@type": type === "image" ? "ImageObject" : "VideoObject",
        contentUrl,
        thumbnailUrl: type === "image" ? undefined : thumbnailUrl,
        caption: item.meta,
        description: item.meta,
      }

      if (item.creatorUsername) {
        base["creator"] = {
          "@type": "Person",
          name: item.creatorUsername,
          url: `https://app.fiddl.art/@${item.creatorUsername}`,
        }
      }

      return base
    }) || []

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": fullUrl,
    name: model.name,
    description: model.longDescription || model.description || "",
    url: fullUrl,
    dateModified: model.updatedAt,
    ...(model.blogLink && { mainEntityOfPage: model.blogLink }),
    ...(customModelCreator && {
      creator: {
        "@type": "Person",
        name: customModelCreator?.userName,
        url: `https://app.fiddl.art/@${customModelCreator.userName}`,
      },
    }),
    ...(model.modelTags?.length && {
      keywords: model.modelTags.join(", "),
    }),
    ...(mediaObjects.length && {
      [type === "image" ? "image" : "video"]: mediaObjects,
    }),
  }

  return JSON.stringify(schema)
}

export function buildMediaEls(
  medias: {
    id: string
    meta: string
    type: "image" | "video"
    creatorUsername?: string
  }[],
): string {
  return medias
    .map(({ id, meta, type, creatorUsername }) => {
      const src = type === "image" ? img(id, "lg") : s3Video(id, "preview-lg")

      const mediaTag = type === "image" ? `<img src="${src}" alt="${meta}" title="${meta}" loading="lazy" />` : `<video src="${src}" alt="${meta}" title="${meta}" loading="lazy" controls muted playsinline></video>`

      return creatorUsername ? `<a href="/profile/${creatorUsername}" rel="author">${mediaTag}</a>` : mediaTag
    })
    .join("\n")
}

export function buildModelMetadataInnerHtml(data: ModelsGetModelByName200): string {
  const { model } = data

  const lines = [
    `<h1>${escapeHtml(model.name)}</h1>`,
    model.longDescription ? `<p>${escapeHtml(model.longDescription)}</p>` : model.description ? `<p>${escapeHtml(model.description)}</p>` : "",
    model.blogLink ? `<p><a href="${escapeHtml(model.blogLink)}">Read more about this model</a></p>` : "",
    `<p>Slug: ${escapeHtml(model.slug)}</p>`,
    `<p>Last updated: ${new Date(model.updatedAt).toLocaleDateString()}</p>`,
    `<ul>${model.modelTags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>`,
  ]

  return lines.filter(Boolean).join("\n")
}
type AnyModel = ModelsGetBaseModels200Item | ModelsGetPublicModels200Item

export function buildModelFooterHtml(models: Partial<AnyModel>[]): string {
  const items = models.map((model) => {
    const link = `<a href="/model/${model.slug}">${escapeHtml(model.name!)}</a>`
    const desc = model.description ? `<p>${escapeHtml(model.description)}</p>` : ""
    const tags = model.modelTags?.length ? `<small>Tags: ${model.modelTags.map((t) => escapeHtml(t)).join(", ")}</small>` : ""
    const updated = model.updatedAt ? `<small>Last updated: <time datetime="${model.updatedAt}">${new Date(model.updatedAt).toLocaleDateString()}</time></small>` : ""

    return `<li>${link}${desc}${tags ? `<br/>${tags}` : ""}${updated ? `<br/>${updated}` : ""}</li>`
  })

  return `<div id="ssr-footer">
  <h2>Explore Models</h2>
  <ul>
    ${items.join("\n")}
  </ul>
</div>`
}

export function buildStaticTopNavHtml(): string {
  return `<nav id="ssr-top-nav">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/browse">Browse</a></li>
    <li><a href="/create">Create</a></li>
    <li><a href="/models">Models</a></li>
    <li><a href="/forge">Forge</a></li>
  </ul>
</nav>`
}
