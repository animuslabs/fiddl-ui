export function setSocialMetadata(html: string, title: string, description: string, imageUrl: string, canonicalUrl: string): string {
  // Helper to create or update meta tags in HTML content
  const updateMetaTag = (html: string, property: string, content: string, attribute: string = "content"): string => {
    const metaTagRegex = new RegExp(`<meta property="${property}" ${attribute}="[^"]*"`, "i")
    const newMetaTag = `<meta property="${property}" ${attribute}="${content}"`

    // Check if the meta tag exists
    if (html.match(metaTagRegex)) {
      // Replace existing meta tag
      return html.replace(metaTagRegex, newMetaTag)
    } else {
      // Append new meta tag if not found
      return html.replace("</head>", `  ${newMetaTag}\n</head>`)
    }
  }

  const updateLinkTag = (html: string, rel: string, href: string): string => {
    const linkTagRegex = new RegExp(`<link rel="${rel}" href="[^"]*"`, "i")
    const newLinkTag = `<link rel="${rel}" href="${href}"`

    // Check if the link tag exists
    if (html.match(linkTagRegex)) {
      // Replace existing link tag
      return html.replace(linkTagRegex, newLinkTag)
    } else {
      // Append new link tag if not found
      return html.replace("</head>", `  ${newLinkTag}\n</head>`)
    }
  }

  html = updateMetaTag(html, "og:title", title)
  html = updateMetaTag(html, "og:description", description)
  html = updateMetaTag(html, "og:image", imageUrl)
  html = updateMetaTag(html, "twitter:title", title)
  html = updateMetaTag(html, "twitter:description", description)
  html = updateMetaTag(html, "twitter:image", imageUrl)
  html = updateLinkTag(html, "canonical", canonicalUrl)

  return html
}
