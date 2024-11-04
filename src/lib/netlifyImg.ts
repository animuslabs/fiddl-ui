import type { ImageSize } from "fiddl-server/dist/lib/types/serverTypes"

const imageApiUrl = process.env.API_URL + "/images/" || "http://localhost:4444/images/"
const avatarsApiUrl = process.env.API_URL + "/avatars/" || "http://localhost:4444/avatars/"
const netlifyImgPath = "/.netlify/images?url=" + imageApiUrl
const netlifyAvatarsPath = "/.netlify/images?url=" + avatarsApiUrl

export function img(id: string, size: ImageSize, width?: number | false, format?: string | false, quality?: number | false): string {
  let params = ""
  if (width) params += `&w=${width}`
  if (format) params += `&fm=${format}`
  if (quality) params += `&q=${quality}`
  if (window.location.hostname === "localhost") return `${imageApiUrl}${id}-${size}.webp`
  else return netlifyImgPath + `${id}-${size}.webp` + params
}

export function avatarImg(userId: string, width?: number | false, format?: string | false, quality?: number | false) {
  let params = ""
  if (width) params += `&w=${width}`
  if (format) params += `&fm=${format}`
  if (quality) params += `&q=${quality}`
  return `${avatarsApiUrl}${userId}.webp`
  // if (window.location.hostname === "localhost") return `${avatarsApiUrl}${userId}.webp`
  // else return netlifyAvatarsPath + `${userId}.webp` + params
}
