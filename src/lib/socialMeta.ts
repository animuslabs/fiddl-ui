/**
 * Dynamically sets social media meta tags for an SPA.
 * @param title - The title of the page
 * @param description - The description of the page
 * @param imageUrl - The URL of the image to use for social previews
 */
export function setSocialMetadata(title: string, description: string, imageUrl: string): void {
  // Helper to create or update meta tags
  const updateMetaTag = (property: string, content: string) => {
    let element = document.querySelector(`meta[property='${property}']`) as HTMLMetaElement | null
    if (!element) {
      element = document.createElement("meta")
      element.setAttribute("property", property)
      document.head.appendChild(element)
    }
    element.setAttribute("content", content)
  }

  updateMetaTag("og:title", title)
  updateMetaTag("og:description", description)
  updateMetaTag("og:image", imageUrl)
  updateMetaTag("twitter:title", title)
  updateMetaTag("twitter:description", description)
  updateMetaTag("twitter:image", imageUrl)
}
