import { img, s3Video } from "./netlifyImg"
import {
  EventsPublicEvents200Item,
  EventsPublicEvents200ItemType,
} from "./orval"

export type PublicEvent = EventsPublicEvents200Item

export type MediaRef = { id: string; type: "image" | "video" }

export function safeParse<T = any>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export function getMediaFromEvent(ev: PublicEvent): MediaRef | null {
  const data = safeParse<any>(ev.dataJSON) || {}
  const mediaType = data.mediaType || data.media_type
  const mediaId = data.mediaId || data.media_id
  const imageId = data.imageId || data.image_id || (mediaType === "image" ? mediaId : undefined)
  const videoId = data.videoId || data.video_id || (mediaType === "video" ? mediaId : undefined)
  if (imageId) return { id: String(imageId), type: "image" }
  if (videoId) return { id: String(videoId), type: "video" }
  return null
}

export function previewUrlForEvent(ev: PublicEvent): string {
  const m = getMediaFromEvent(ev)
  if (!m) return "/blankAvatar.webp"
  return m.type === "image" ? img(m.id, "sm") : s3Video(m.id, "thumbnail")
}

export function actionTextForPublic(ev: PublicEvent): string {
  const u = ev.originUsername || "someone"
  switch (ev.type as EventsPublicEvents200ItemType) {
    case "likedImage":
      return `@${u} liked an image`
    case "likedVideo":
      return `@${u} liked a video`
    case "unlikedImage":
      return `@${u} removed their like on an image`
    case "unlikedVideo":
      return `@${u} removed their like on a video`
    case "unlockedImage":
      return `@${u} unlocked an image`
    case "unlockedVideo":
      return `@${u} unlocked a video`
    case "addedImageToCollection":
      return `@${u} added an image to a collection`
    case "removedImageFromCollection":
      return `@${u} removed an image from a collection`
    case "creationCommented":
      return `@${u} commented on a creation`
    case "commentMentioned":
      return `@${u} mentioned someone in a comment`
    case "missionCompleted":
      return `Mission completed`
    case "referredUser":
      return `@${u} joined from a referral`
    case "earnedComission":
      return `Commission earned`
    case "asyncError":
      return `A generation failed`
    default:
      return `Activity: ${ev.type}`
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export const UNLOCK_LIKE_TYPES: EventsPublicEvents200ItemType[] = [
  "likedImage",
  "likedVideo",
  "unlockedImage",
  "unlockedVideo",
]
