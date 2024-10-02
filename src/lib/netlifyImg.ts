import type { ImageSize } from "fiddl-server/dist/lib/types/serverTypes"

const imageApiUrl = process.env.API_URL + "/images/" || "http://localhost:4444/images/"
const netlifyImgPath = "/.netlify/images?url=" + imageApiUrl

export function img(id: string, size: ImageSize, width?: number | false, format?: string | false, quality?: number | false): string {
  let params = ""
  if (width) params += `&w=${width}`
  if (format) params += `&fm=${format}`
  if (quality) params += `&q=${quality}`
  if (window.location.hostname === "localhost") return `${imageApiUrl}${id}-${size}.webp`
  else return netlifyImgPath + `${id}-${size}.webp` + params
}
