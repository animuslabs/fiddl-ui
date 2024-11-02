export function setSocialMetadata(html: string, title: string, description: string, imageUrl: string, canonicalUrl: string): string {
  // Helper to create or update meta tags in HTML content
  const updateMetaTag = (html: string, property: string, content: string, attribute: string = "content"): string => {
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
  html = updateMetaTag(html, "twitter:title", title)
  html = updateMetaTag(html, "twitter:description", description)
  html = updateMetaTag(html, "twitter:image", imageUrl)
  html = updateLinkTag(html, "canonical", canonicalUrl)

  return html
}
