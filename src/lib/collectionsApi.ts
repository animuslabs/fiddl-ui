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
    | (undefined | ((p: any) => Promise<{ data: any[] }>))
    | undefined

  const offset = Math.max(0, (page - 1) * pageSize)

  if (unified) {
    const req: any = {
      id,
      offset,
      limit: pageSize,
    }
    if (search) req.promptIncludes = search
    if (mediaType !== "all") req.mediaType = mediaType

    const { data } = await unified(req)
    return (data || []).map((row: any) => {
      const t: MediaType = (row.mediaType || row.type) === "video" ? "video" : "image"
      const mid = row.id || row.imageId || row.videoId
      return {
        id: mid,
        url: t === "video" ? s3Video(mid, "preview-sm") : img(mid, "md"),
        type: t,
      }
    })
  }

  // Fallback to legacy endpoints if unified endpoint not available
  // Note: legacy endpoints do not support pagination or search; emulate by slicing.
  const items: GalleryItem[] = []
  if (mediaType !== "video" && (api as any).collectionsGetCollectionImages) {
    const { data } = await (api as any).collectionsGetCollectionImages({ id })
    const list = Array.isArray(data) ? data : []
    const filtered = list
      .filter((x: any) => (search ? (x.prompt?.includes?.(search) || x.id?.includes?.(search)) : true))
      .map((x: any) => ({ id: x.id, url: img(x.id, "md"), type: "image" as const }))
    items.push(...filtered)
  }
  if (mediaType !== "image" && (api as any).collectionsGetCollectionVideos) {
    const { data } = await (api as any).collectionsGetCollectionVideos({ id })
    const list = Array.isArray(data) ? data : []
    const filtered = list
      .filter((x: any) => (search ? (x.prompt?.includes?.(search) || x.id?.includes?.(search)) : true))
      .map((x: any) => ({ id: x.id, url: s3Video(x.id, "preview-sm"), type: "video" as const }))
    items.push(...filtered)
  }

  // Deterministic order (newest first if createdAt available)
  items.sort((a: any, b: any) => {
    const ad = new Date(a.createdAt || 0).getTime()
    const bd = new Date(b.createdAt || 0).getTime()
    return bd - ad
  })

  return items.slice(offset, offset + pageSize)
}

