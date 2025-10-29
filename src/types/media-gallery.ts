export interface MediaGalleryMeta {
  id: string
  url?: string
  aspectRatio?: number
  // Preferred field used by this component
  type?: "image" | "video"
  // Back-compat for API objects that provide `mediaType`
  mediaType?: "image" | "video"
  requestId?: string
  requestType?: "image" | "video"
  isPublic?: boolean
  requestQuantity?: number
  placeholder?: boolean
  nsfw?: boolean
  // Optional creator metadata (when available from caller)
  creatorId?: string
  creatorUsername?: string
  creatorHasAvatar?: boolean
}
