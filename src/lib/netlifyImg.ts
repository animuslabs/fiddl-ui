import type { ImageSize } from "../../../fiddl-server/dist/lib/types/serverTypes"

const imageApiUrl = import.meta.env.VITE_API_URL + "/images/" || "http://localhost:4444/images/"
const avatarsApiUrl = import.meta.env.VITE_API_URL + "/avatars/" || "http://localhost:4444/avatars/"
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

export function s3Img(s3Key: string, size?: ImageSize, width?: number | false, format?: string | false, quality?: number | false): string {
  let params = ""
  if (width) params += `&w=${width}`
  if (format) params += `&fm=${format}`
  if (quality) params += `&q=${quality}`
  // if (window.location.hostname === "localhost") return `${imageApiUrl}${s3Key}-${size}.webp`
  // else return import.meta.env.VITE_S3_URL + `s3Key`
  return import.meta.env.VITE_S3_URL + `/${s3Key}`
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

export const trainingSetThumbnailKey = (trainingSetId: string, thumbnailId: string) => `trainingSets/${trainingSetId}/thumbnails/${thumbnailId}.webp`
