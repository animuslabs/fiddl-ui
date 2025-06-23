type TwitterCardType = "summary" | "summary_large_image" | "app" | "player"

export function setSocialMetadata(html: string, title: string, description: string, imageUrl: string, canonicalUrl: string, twitterCard: TwitterCardType): string {
  // Helper to create or update meta tags in HTML content
  const updateMetaTag = (html: string, property: string, content: string, attribute = "content"): string => {
    // Matching meta tags with flexible attribute formats
    const metaTagRegex = new RegExp(`<meta\\s+[^>]*?property=["']?${property}["']?\\s+[^>]*${attribute}=["']?[^"']*["']?\\s*/?>`, "gi")
    const newMetaTag = `<meta property="${property}" ${attribute}="${content}" />`

    if (html.search(metaTagRegex) !== -1) {
      // Replace existing meta tag
      return html.replace(metaTagRegex, newMetaTag)
    } else {
      // Append new meta tag if not found
      return html.replace("</head>", `  ${newMetaTag}\n</head>`)
    }
  }

  const updateLinkTag = (html: string, rel: string, href: string): string => {
    // Matching link tags with flexible attribute formats
    const linkTagRegex = new RegExp(`<link\\s+[^>]*?rel=["']?${rel}["']?\\s+[^>]*href=["']?[^"']*["']?\\s*/?>`, "gi")
    const newLinkTag = `<link rel="${rel}" href="${href}" />`

    if (html.search(linkTagRegex) !== -1) {
      // Replace existing link tag
      return html.replace(linkTagRegex, newLinkTag)
    } else {
      // Append new link tag if not found
      return html.replace("</head>", `  ${newLinkTag}\n</head>`)
    }
  }

  // Update meta tags
  html = updateMetaTag(html, "og:title", title)
  html = updateMetaTag(html, "og:description", description)
  html = updateMetaTag(html, "og:image", imageUrl)
  html = updateMetaTag(html, "twitter:card", twitterCard)
  html = updateMetaTag(html, "twitter:title", title)
  html = updateMetaTag(html, "twitter:description", description)
  html = updateMetaTag(html, "twitter:image", imageUrl)
  html = updateLinkTag(html, "canonical", canonicalUrl)

  return html
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
