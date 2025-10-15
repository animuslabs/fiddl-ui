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

/* ────────── helpers ────────── */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
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

interface SocialMeta {
  title: string
  description: string
  imageUrl: string
  ogUrl: string
  canonicalUrl: string
  twitterCard?: TwitterCardType
  twitterImageAlt?: string
  ogType?: string
}

export function setSocialMetadata(html: string, meta: SocialMeta): string {
  const { title, description, imageUrl, ogUrl, canonicalUrl, twitterCard = "summary_large_image", twitterImageAlt = description, ogType = "website" } = meta

  // remove only the OG/Twitter tags we override (preserve any custom OG/Twitter tags)
  const overridden = [
    "og:title",
    "og:description",
    "og:image",
    "og:url",
    "og:type",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
  ]
  const rx = new RegExp(
    `<meta\\s+[^>]*?(?:property|name)=["']?(?:${overridden.join("|")})["'][^>]*?>`,
    "gi",
  )
  html = html.replace(rx, "").replace(/<link\s+[^>]*?rel=["']?canonical["'][^>]*?>/gi, "")

  const tags = [
    `<meta property="og:type"          content="${escapeAttr(ogType)}">`,
    `<meta property="og:title"         content="${escapeAttr(title)}">`,
    `<meta property="og:description"   content="${escapeAttr(description)}">`,
    `<meta property="og:image"         content="${escapeAttr(imageUrl)}">`,
    `<meta property="og:url"           content="${escapeAttr(ogUrl)}">`,

    `<meta name="twitter:card"         content="${escapeAttr(twitterCard)}">`,
    `<meta name="twitter:title"        content="${escapeAttr(title)}">`,
    `<meta name="twitter:description"  content="${escapeAttr(description)}">`,
    `<meta name="twitter:image"        content="${escapeAttr(imageUrl)}">`,
    `<meta name="twitter:image:alt"    content="${escapeAttr(twitterImageAlt)}">`,

    `<link rel="canonical"             href="${escapeAttr(canonicalUrl)}">`,
  ].join("\n  ")

  return html.replace(/<\/head>/i, `  ${tags}\n</head>`)
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    //@ts-ignore
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function longIdToShort(uuid: string): string {
  // Remove hyphens from the UUID
  const hexStr = uuid.replace(/-/g, "")
  // Convert the hex string to a Uint8Array
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16)
  }
  // Convert the byte array to a Base64 string
  const base64 = arrayBufferToBase64(bytes.buffer)
  // Convert Base64 to Base64 URL encoding
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return base64url
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
    media?.slice(0, 10).map((item: ModelsGetModelByName200MediaItem, i: number) => {
      const contentUrl = type === "image" ? img(item.id, "lg") : s3Video(item.id, "preview-lg")
      const thumbnailUrl = s3Video(item.id, "thumbnail")

      // Derive a concise, SEO-friendly name for media items.
      // Google requires `name` on VideoObject; use the first few
      // words of the meta/prompt, or fall back to the model name.
      const buildName = (): string => {
        const src = (item.meta || "").trim()
        if (src) {
          const words = src.split(/\s+/).slice(0, 12)
          return words.join(" ")
        }
        return `${model.name} sample ${i + 1}`
      }

      const base: Record<string, any> = {
        "@type": type === "image" ? "ImageObject" : "VideoObject",
        contentUrl,
        thumbnailUrl: type === "image" ? undefined : thumbnailUrl,
        // Include a `name` for better video indexing
        name: buildName(),
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
export type MediaItem = {
  id: string
  meta: string
  type: "image" | "video"
  creatorUsername?: string
}
export function buildMediaEls(medias: MediaItem[]): string {
  return medias
    .map(({ id, meta, type, creatorUsername }) => {
      const src = type === "image" ? img(id, "lg") : s3Video(id, "preview-lg")

      const mediaTag = type === "image" ? `<img src="${src}" alt="${meta}" title="${meta}" loading="lazy" />` : `<video src="${src}" title="${meta}" loading="lazy" controls muted playsinline></video>`

      return creatorUsername ? `<a href="/@${creatorUsername}" rel="author">${mediaTag}</a>` : mediaTag
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
    const link =
      "id" in model //
        ? `<a href="/model/custom/${model.id}">${escapeHtml(model.name || "Custom Model")}</a>`
        : `<a href="/model/${model.slug}">${escapeHtml(model.name!)}</a>`
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
  <div class="legal-links" style="margin-top:8px;font-size:12px;color:#9aa0a6;">
    <a href="https://fiddl.art/privacy-policy" style="color:#9aa0a6;text-decoration:none;">Privacy Policy</a>
    <span aria-hidden="true" style="margin:0 6px;">•</span>
    <a href="https://fiddl.art/terms-of-service" style="color:#9aa0a6;text-decoration:none;">Terms of Service</a>
  </div>
</div>`
}

export function buildStaticTopNavHtml(): string {
  return `<nav id="ssr-top-nav">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/browse">Browse</a></li>
    <li><a href="/create">Create</a></li>
    <li><a href="/missions">Missions</a></li>
    <li><a href="/models">Models</a></li>
    <li><a href="/forge">Forge</a></li>
  </ul>
</nav>`
}

export function buildMediaListSchema(medias: MediaItem[], pageUrl: string): string {
  const itemListElement = medias.map((m, i) => {
    const isImage = m.type === "image"
    const contentUrl = isImage ? img(m.id, "lg") : s3Video(m.id, "preview-lg")
    const obj: Record<string, unknown> = {
      "@type": isImage ? "ImageObject" : "VideoObject",
      contentUrl,
      ...(isImage ? {} : { thumbnailUrl: s3Video(m.id, "thumbnail") }),
      name: m.meta,
      description: m.meta,
    }
    if (m.creatorUsername) {
      obj.creator = {
        "@type": "Person",
        name: m.creatorUsername,
        url: `https://app.fiddl.art/@${m.creatorUsername}`,
      }
    }
    return {
      "@type": "ListItem",
      position: i + 1,
      item: obj,
    }
  })

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    itemListElement,
  }

  return JSON.stringify(schema)
}

export function renderJsonAsHtml(data: unknown, title?: string): string {
  const body = renderJsonAsHtmlInner(data)
  return title ? `<section><h2>${escapeHtml(title)}</h2>\n${body}</section>` : body
}
function renderJsonAsHtmlInner(data: unknown): string {
  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return `<span>${escapeHtml(String(data))}</span>`
  }

  if (Array.isArray(data)) {
    return `<ul>${data.map((item) => `<li>${renderJsonAsHtmlInner(item)}</li>`).join("")}</ul>`
  }

  if (data && typeof data === "object") {
    return `<dl>${Object.entries(data)
      .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${renderJsonAsHtmlInner(value)}</dd>`)
      .join("")}</dl>`
  }

  return `<span>null</span>`
}
