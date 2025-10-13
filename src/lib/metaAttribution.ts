export interface MetaAttributionPayload {
  fbp?: string
  fbc?: string
  eventSourceUrl?: string
  userAgent?: string
}

// Cache to avoid repeated cookie and URL parsing
let cached: Partial<MetaAttributionPayload> | null = null

export function getMetaAttribution(): MetaAttributionPayload {
  if (typeof window === "undefined") return {}
  const out: MetaAttributionPayload = {}

  try {
    const fbp = cached?.fbp ?? readCookie("_fbp")
    if (fbp) {
      out.fbp = fbp
      cached = { ...(cached || {}), fbp }
    }
  } catch {}

  try {
    const url = new URL(window.location.href)
    const fbclid = url.searchParams.get("fbclid")?.trim()
    // Prefer building from current fbclid when present; otherwise fall back to the _fbc cookie set by the Pixel.
    let fbc = cached?.fbc ?? buildFbcFromFbclid(fbclid || undefined)
    if (!fbc) {
      const cookieFbc = readCookie("_fbc")
      if (cookieFbc && typeof cookieFbc === "string" && cookieFbc.startsWith("fb.1.")) {
        fbc = cookieFbc
      }
    }
    if (fbc) {
      out.fbc = fbc
      cached = { ...(cached || {}), fbc }
    }
  } catch {}

  try {
    out.eventSourceUrl = window.location.href
  } catch {}

  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined
    if (ua) out.userAgent = ua
  } catch {}

  return out
}

export function buildFbcFromFbclid(fbclid?: string | null, timestampSeconds?: number): string | undefined {
  const id = (fbclid || "").trim()
  if (!id) return undefined
  const ts = typeof timestampSeconds === "number" && isFinite(timestampSeconds) ? timestampSeconds : Math.floor(Date.now() / 1000)
  return `fb.1.${ts}.${id}`
}

export function generateEventId(): string | undefined {
  try {
    // Prefer Web Crypto if available
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  } catch {}
  // Fallback simple UUID v4-ish
  try {
    const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1)
    return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`
  } catch {}
  return undefined
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
