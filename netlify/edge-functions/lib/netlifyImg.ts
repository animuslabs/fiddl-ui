type ImageSize = "sm" | "md" | "lg" | "original"
const env = Netlify.env.toObject()

export const previewFiles = {
  thumbnail: "webp",
  "preview-lg": "mp4",
  "preview-sm": "mp4",
  "preview-md": "mp4",
} as const
export type PreviewFileName = keyof typeof previewFiles

export const previewVideoFileKey = (videoId: string, type: PreviewFileName) => `previewVideos/${videoId}/${videoId}-${type}.${previewFiles[type]}`
export const originalFileKey = (videoId: string) => `originalVideos/${videoId}-original.mp4`

export function img(id: string, size: ImageSize, _width?: number | false, _format?: string | false, _quality?: number | false): string {
  // All compressed images are served via CDN (S3 fronted by CloudFront)
  return `${env.VITE_S3_URL}/compressedImages/${id}-${size}.webp`
}

export function s3Img(s3Key: string, size?: ImageSize, width?: number | false, format?: string | false, quality?: number | false): string {
  let params = ""
  if (width) params += `&w=${width}`
  if (format) params += `&fm=${format}`
  if (quality) params += `&q=${quality}`
  // if (window.location.hostname === "localhost") return `${imageApiUrl}${s3Key}-${size}.webp`
  // else return import.meta.env.VITE_S3_URL + `s3Key`
  return env.VITE_S3_URL + `/${s3Key}`
}
export function s3Video(videoId: string, type: PreviewFileName): string {
  const key = previewVideoFileKey(videoId, type)
  return env.VITE_S3_URL + `/${key}`
}

export function avatarImg(userId: string, _width?: number | false, _format?: string | false, _quality?: number | false) {
  // Avatars are served from CDN as well; Edge cannot access local cache versioning
  return `${env.VITE_S3_URL}/avatars/${userId}.webp`
}

export const trainingSetThumbnailKey = (trainingSetId: string, thumbnailId: string) => `trainingSets/${trainingSetId}/thumbnails/${thumbnailId}.webp`
