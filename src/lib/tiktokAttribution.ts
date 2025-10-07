export interface TikTokAttributionPayload {
  ttclid?: string
  ttp?: string
  userAgent?: string
}

const STORAGE_KEY = "ttclid"

let cached: Partial<TikTokAttributionPayload> | null = null

export function captureTikTokAttributionFromPage(): void {
  if (typeof window === "undefined") return
  try {
    const url = new URL(window.location.href)
    const ttclid = url.searchParams.get("ttclid")?.trim()
    if (ttclid) {
      try {
        window.localStorage?.setItem(STORAGE_KEY, ttclid)
      } catch {}
      cached = { ...(cached || {}), ttclid }
    } else if (!cached?.ttclid) {
      try {
        const stored = window.localStorage?.getItem(STORAGE_KEY) || undefined
        if (stored) cached = { ...(cached || {}), ttclid: stored }
      } catch {}
    }
  } catch {}

  // Prime cached cookie value for faster subsequent reads
  const ttp = readCookie("_ttp")
  if (ttp) cached = { ...(cached || {}), ttp }
}

export function getTikTokAttribution(): TikTokAttributionPayload {
  if (typeof window === "undefined") return {}
  const payload: TikTokAttributionPayload = {}

  try {
    const stored = cached?.ttclid ?? window.localStorage?.getItem(STORAGE_KEY) ?? undefined
    if (stored) {
      payload.ttclid = stored
      cached = { ...(cached || {}), ttclid: stored }
    }
  } catch {}

  try {
    const ttp = cached?.ttp ?? readCookie("_ttp")
    if (ttp) {
      payload.ttp = ttp
      cached = { ...(cached || {}), ttp }
    }
  } catch {}

  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined
    if (ua) payload.userAgent = ua
  } catch {}

  return payload
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined
  try {
    const prefix = `${name}=`
    const entries = document.cookie ? document.cookie.split("; ") : []
    for (const entry of entries) {
      if (entry.startsWith(prefix)) return entry.slice(prefix.length)
    }
  } catch {}
  return undefined
}
