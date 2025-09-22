import * as api from "./orval"
import { collectionsFindCollectionByName } from "./orval"
import type { MediaType } from "./types"
import { img, s3Video } from "./netlifyImg"

export type CollectionMediaFilter = {
  ownerId: string
  collectionName?: string // defaults to 'likes'
  page: number
  pageSize: number
  mediaType?: MediaType | "all"
  search?: string | null
}

export type CollectionMediaItem = {
  id: string
  type: MediaType
}

export type GalleryItem = {
  id: string
  url: string
  type: MediaType
  nsfw?: boolean
}

export async function getCollectionId(ownerId: string, collectionName = "likes"): Promise<string | null> {
  const res = await collectionsFindCollectionByName({ collectionName, ownerId }).catch(() => null)
  return res?.data?.id ?? null
}

/**
 * Fetch collection media (images/videos) with pagination and optional search.
 * Uses collectionsGetCollectionMedia when available; otherwise falls back to
 * separate image/video endpoints and slices locally.
 */
export async function fetchCollectionMedia(params: CollectionMediaFilter): Promise<GalleryItem[]> {
  const { ownerId, collectionName = "likes", page, pageSize, mediaType = "all", search } = params
  const id = await getCollectionId(ownerId, collectionName)
  if (!id) return []

  // Prefer unified endpoint if present in generated API
  const unified = (api as any).collectionsGetCollectionMedia as
    | (undefined | ((p: any) => Promise<{ data: { items?: any[] } }>))
    | undefined

  const offset = Math.max(0, (page - 1) * pageSize)

  if (unified) {
    const req: any = {
      id,
      offset,
      limit: pageSize,
      order: "desc",
    }
    if (search) req.promptIncludes = search
    if (mediaType !== "all") req.mediaType = mediaType

    const { data } = await unified(req)
    const items = Array.isArray((data as any)?.items) ? (data as any).items : []
    return items.map((row: any) => {
      const rawType = (row.mediaType ?? row.type ?? "").toString().toLowerCase()
      const t: MediaType = rawType === "video" ? "video" : "image"
      const mid = row.mediaId || row.id || row.imageId || row.videoId
      const nsfw = row.nsfw === true || row.media?.nsfw === true
      return {
        id: String(mid),
        url: t === "video" ? s3Video(String(mid), "preview-sm") : img(String(mid), "md"),
        type: t,
        nsfw,
      }
    })
  }

  // Fallback to legacy endpoints if unified endpoint not available
  const items: GalleryItem[] = []
  // Images
  if (mediaType !== "video" && (api as any).collectionsGetCollectionImages) {
    const { data } = await (api as any).collectionsGetCollectionImages({
      id,
      offset,
      limit: mediaType === "image" ? pageSize : undefined,
      order: "desc",
      promptIncludes: search || undefined,
    })
    const list = Array.isArray(data) ? data : []
    const mapped = list.map((x: any) => ({ id: x.id, url: img(x.id, "md"), type: "image" as const, nsfw: x.nsfw === true }))
    items.push(...mapped)
  }
  // Videos
  if (mediaType !== "image" && (api as any).collectionsGetCollectionVideos) {
    const { data } = await (api as any).collectionsGetCollectionVideos({
      id,
      offset,
      limit: mediaType === "video" ? pageSize : undefined,
      order: "desc",
      promptIncludes: search || undefined,
    })
    const list = Array.isArray(data) ? data : []
    const mapped = list.map((x: any) => ({ id: x.id, url: s3Video(x.id, "preview-sm"), type: "video" as const, nsfw: x.nsfw === true }))
    items.push(...mapped)
  }

  // For mixed media fallback (mediaType === 'all'), merge and slice client-side
  if (mediaType === "all") {
    return items.slice(0, pageSize)
  }
  return items
}
