import { differenceInSeconds, parseISO } from "date-fns"
import type { CommentsList200CommentsItem } from "src/lib/orval"

export type MentionStatus = "loading" | "valid" | "invalid"

export type MentionResolution = {
  status: MentionStatus | null
  username?: string | null
}

export type CommentSegment = {
  text: string
  status: MentionStatus | null
  isMention: boolean
  handle?: string | null
  username?: string | null
}

export interface CommentViewModel extends CommentsList200CommentsItem {
  decodedContent: string
}

const MENTION_PATTERN = "(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,32})"
const CONTENT_DECODE_CACHE = new Map<string, string>()
const HAS_WINDOW = typeof window !== "undefined"

export function createMentionRegex(): RegExp {
  return new RegExp(MENTION_PATTERN, "g")
}

export function extractMentionHandles(text: string): string[] {
  if (!text) return []
  const regex = createMentionRegex()
  const results: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const handle = match[2]?.toLowerCase()
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    results.push(handle)
  }
  return results
}

export function buildSegments(text: string, resolver: (handle: string) => MentionResolution): CommentSegment[] {
  const segments: CommentSegment[] = []
  if (!text) return segments

  const regex = createMentionRegex()
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const boundaryLength = match[1]?.length ?? 0
    const mentionStart = match.index + boundaryLength
    const rawHandle = match[2] || ""
    const mentionEnd = mentionStart + 1 + rawHandle.length

    if (mentionStart > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, mentionStart),
        status: null,
        isMention: false,
        handle: null,
        username: null,
      })
    }

    if (!rawHandle) {
      segments.push({
        text: text.slice(mentionStart, mentionEnd),
        status: null,
        isMention: false,
        handle: null,
        username: null,
      })
    } else {
      const resolved = resolver(rawHandle.toLowerCase())
      segments.push({
        text: text.slice(mentionStart, mentionEnd),
        status: resolved.status ?? null,
        isMention: true,
        handle: rawHandle,
        username: resolved.username ?? rawHandle,
      })
    }

    lastIndex = mentionEnd
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      status: null,
      isMention: false,
      handle: null,
      username: null,
    })
  }

  return segments
}

export function decodeCommentContent(commentId: string, content: string): string {
  if (!content) return ""
  const cacheKey = `${commentId}:${content}`
  const cached = CONTENT_DECODE_CACHE.get(cacheKey)
  if (cached) return cached

  if (!HAS_WINDOW) return content

  const textarea = document.createElement("textarea")
  textarea.innerHTML = content
  const decoded = textarea.value
  CONTENT_DECODE_CACHE.set(cacheKey, decoded)
  return decoded
}

export function normalizeComment(raw: any): CommentViewModel {
  const id = String(raw?.id ?? "")
  const createdAt = raw?.createdAt ?? new Date().toISOString()
  const updatedAt = raw?.updatedAt ?? raw?.createdAt ?? createdAt
  const content = raw?.content ?? ""

  const mentionsArray = Array.isArray(raw?.mentions) ? raw.mentions.filter(Boolean) : []
  const normalizedMentions = mentionsArray.map((mention: any) => ({
    id: String(mention?.id ?? ""),
    username: typeof mention?.username === "string" && mention.username.length > 0 ? mention.username : null,
  }))

  return {
    id,
    createdAt,
    updatedAt,
    content,
    userId: raw?.userId ?? "",
    imageId: raw?.imageId ?? null,
    videoId: raw?.videoId ?? null,
    edited: Boolean(raw?.edited),
    author: {
      id: String(raw?.author?.id ?? raw?.userId ?? ""),
      username: typeof raw?.author?.username === "string" && raw.author.username.length > 0 ? raw.author.username : null,
    },
    mentions: normalizedMentions,
    decodedContent: decodeCommentContent(id, content),
  } as CommentViewModel
}

export function formatTimestamp(value: string | null | undefined): string {
  const parsed = parseCommentTimestamp(value)
  if (!parsed) return "just now"
  try {
    const now = new Date()
    const seconds = Math.max(0, differenceInSeconds(now, parsed))

    if (seconds < 45) return "just now"
    if (seconds < 90) return "1m ago"

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`

    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks}w ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`

    const years = Math.floor(days / 365)
    return years <= 1 ? "1y ago" : `${years}y ago`
  } catch (err) {
    console.error("Failed to format comment timestamp", err)
    return "just now"
  }
}

export function parseCommentTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalizedBase = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
  const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(normalizedBase)
  const candidate = hasTimezone ? normalizedBase : `${normalizedBase}Z`

  const direct = new Date(candidate)
  if (!Number.isNaN(direct.getTime())) return direct

  try {
    const parsed = parseISO(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed
  } catch (err) {
    console.warn("Unable to parse comment timestamp", value, err)
  }

  return null
}

export function segmentClass(segment: CommentSegment) {
  return {
    "media-comment-mention": segment.isMention,
    "mention-valid": segment.status === "valid",
    "mention-invalid": segment.status === "invalid",
    "mention-loading": segment.status === "loading",
  }
}

export function segmentTooltip(segment: CommentSegment): string | null {
  if (!segment.isMention) return null
  const mentionText = segment.text.trim() || (segment.username ? `@${segment.username}` : "")

  switch (segment.status) {
    case "valid":
      return mentionText ? `Mention will notify ${mentionText}` : "Mention will notify this user"
    case "invalid":
      return mentionText ? `No account found for ${mentionText}` : "No account found"
    case "loading":
      return mentionText ? `Checking ${mentionText}...` : "Checking mention..."
    default:
      return null
  }
}
