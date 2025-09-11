// netlify/edge-functions/lib/page.ts
import type { Context } from "@netlify/edge-functions"

export type OgType = "website" | "article" | "profile" | "video.other"
export type TwitterCard = "summary" | "summary_large_image" | "player" | "app"

export type SocialMetaInput = {
  title?: string
  description: string
  imageUrl: string
  ogUrl?: string // defaults to canonicalUrl
  canonicalUrl?: string // defaults to clean origin+pathname
  ogType?: OgType // defaults to "website"
  twitterCard?: TwitterCard // defaults to "summary_large_image"
  twitterImageAlt?: string
}

export type CacheConfig = {
  edgeTtl?: number // seconds, default 3600
  edgeSwr?: number // seconds, default 300
  browser?: "no-store" | "revalidate" // default "revalidate"
  tags?: string[] // optional Cache-Tag
  cacheId?: string // optional Netlify-Cache-ID
  namespace?: string // CacheStorage bucket name; default "pages"
}

export type PageBlocks = {
  htmlBlocks?: string[] // already-sanitized HTML snippets you want injected
  jsonLd?: string[] // array of JSON-LD strings (already stringified)
  title?: string // optional <title> override (separate from OG title)
}

export type BuildPageConfig = {
  request: Request
  context: Context
  pageTitle?: string // optional page title override
  social?: SocialMetaInput
  cache?: CacheConfig
  blocks?: PageBlocks
  transformHtml?: (html: string) => string // optional last-mile transform
  // If you want to supply upstream HTML yourself (e.g. already fetched), pass it here
  upstreamHtml?: string
}

// ───────── helpers ─────────

function cleanUrl(u: URL): string {
  // canonical = origin + pathname (no query)
  return `${u.origin}${u.pathname}`
}

function replaceTitle(html: string, title: string): string {
  // add or replace <title>
  if (/<title>.*?<\/title>/i.test(html)) {
    return html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
  }
  return html.replace(/<\/head>/i, `  <title>${title}</title>\n</head>`)
}

function injectJsonLd(html: string, jsonLd: string[]): string {
  if (!jsonLd?.length) return html
  const block = jsonLd.map((s) => `<script type="application/ld+json">${s}</script>`).join("\n")
  return html.replace(/<\/head>/i, `  ${block}\n</head>`)
}

function injectSsrBlocks(html: string, blocks: string[]): string {
  if (!blocks?.length) return html
  const wrapper = `<div class="ssr-metadata">\n${blocks.join("\n")}\n</div>`
  return html.replace(/<body([^>]*)>/i, `<body$1>\n${wrapper}`)
}

function setSocial(html: string, meta: Required<SocialMetaInput>): string {
  // remove only the OG/Twitter tags we override (leave custom ones intact)
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
  html = html
    .replace(rx, "")
    .replace(/<link\s+[^>]*?rel=["']?canonical["'][^>]*?>/gi, "")

  const tags = [
    `<meta property="og:type"        content="${meta.ogType}">`,
    `<meta property="og:title"       content="${escapeAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
    `<meta property="og:image"       content="${escapeAttr(meta.imageUrl)}">`,
    `<meta property="og:url"         content="${escapeAttr(meta.ogUrl)}">`,

    `<meta name="twitter:card"       content="${meta.twitterCard}">`,
    `<meta name="twitter:title"      content="${escapeAttr(meta.title)}">`,
    `<meta name="twitter:description"content="${escapeAttr(meta.description)}">`,
    `<meta name="twitter:image"      content="${escapeAttr(meta.imageUrl)}">`,
    ...(meta.twitterImageAlt ? [`<meta name="twitter:image:alt" content="${escapeAttr(meta.twitterImageAlt)}">`] : []),

    `<link rel="canonical"           href="${escapeAttr(meta.canonicalUrl)}">`,
  ].join("\n  ")

  return html.replace(/<\/head>/i, `  ${tags}\n</head>`)
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildHeaders(cfg?: CacheConfig): Headers {
  const edgeTtl = cfg?.edgeTtl ?? 86400
  const edgeSwr = cfg?.edgeSwr ?? 300
  const browserCtl = cfg?.browser === "no-store" ? "no-store" : "max-age=0, must-revalidate"

  const h = new Headers()
  h.set("Content-Type", "text/html; charset=utf-8")
  h.set("Cache-Control", browserCtl)
  h.set("Netlify-CDN-Cache-Control", `public, max-age=${edgeTtl}, stale-while-revalidate=${edgeSwr}`)
  if (cfg?.tags?.length) h.set("Cache-Tag", cfg.tags.join(","))
  if (cfg?.cacheId) h.set("Netlify-Cache-ID", cfg.cacheId)
  return h
}

// ───────── main constructor ─────────

export async function buildPageResponse({ request, context, social, pageTitle, cache, blocks, transformHtml, upstreamHtml }: BuildPageConfig): Promise<Response> {
  const url = new URL(request.url)

  // programmatic CacheStorage
  const namespace = cache?.namespace ?? "pages"
  const kv = await caches.open(namespace)
  const key = new Request(url.toString())

  // early return if cached
  const cached = await kv.match(key)
  if (cached) return cached

  // get upstream HTML (from origin) unless provided
  const res = upstreamHtml ? undefined : await context.next()
  const baseHtml = upstreamHtml ?? (await (res as Response).text())

  // defaults for social meta
  const canonical = social?.canonicalUrl || cleanUrl(url)
  const meta: Required<SocialMetaInput> = {
    title: social?.title ?? pageTitle ?? "Fiddl.art",
    description: social?.description ?? "",
    imageUrl: social?.imageUrl ?? "",
    ogUrl: social?.ogUrl || canonical,
    canonicalUrl: canonical,
    ogType: social?.ogType ?? "website",
    twitterCard: social?.twitterCard ?? "summary_large_image",
    twitterImageAlt: social?.twitterImageAlt ?? "",
  }

  // assemble HTML
  let html = baseHtml
  if (blocks?.title) html = replaceTitle(html, blocks.title || pageTitle || new URL(request.url).pathname.split("/").pop() + "| Fiddl.art")
  if (blocks?.jsonLd?.length) html = injectJsonLd(html, blocks.jsonLd)
  if (!meta.description) meta.description = "Explore AI-generated creations on Fiddl.art"
  if (social) html = setSocial(html, meta)
  const h1Block = `<h1>${escapeAttr(pageTitle || meta.title || "Fiddl.art")}</h1>`
  const htmlBlocksWithH1 = [h1Block, ...(blocks?.htmlBlocks || [])]
  html = injectSsrBlocks(html, htmlBlocksWithH1)
  html = html.replace(/<html([^>]*)>/i, `<html lang="en"$1>`)
  if (transformHtml) html = transformHtml(html)

  // build response & headers
  const headers = buildHeaders(cache)
  const status = res ? (res as Response).status : 200
  const response = new Response(html, { status, headers })

  // store in programmatic cache if ok
  if (response.ok) await kv.put(key, response.clone())

  return response
}
