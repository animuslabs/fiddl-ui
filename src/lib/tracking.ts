import { getTikTokAttribution } from "./tiktokAttribution"
import { getMetaAttribution } from "./metaAttribution"

export interface ClientTrackingPayload {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrerUrl?: string
  landingUrl?: string
  gclid?: string
  fbclid?: string
  ttclid?: string
  fbp?: string
  fbc?: string
  source?: string
}

const STORAGE_KEYS = {
  landingUrl: "ft_landing_url",
  utm_prefix: "ft_utm_",
  gclid: "ft_gclid",
  fbclid: "ft_fbclid",
} as const

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const

/**
 * Capture first-touch attribution from the current page into localStorage.
 * Safe to call multiple times; only fills missing values.
 */
export function captureFirstTouchAttributionFromPage(): void {
  if (typeof window === "undefined") return
  try {
    const url = new URL(window.location.href)
    // Landing URL
    try {
      if (!window.localStorage.getItem(STORAGE_KEYS.landingUrl)) {
        window.localStorage.setItem(STORAGE_KEYS.landingUrl, url.toString())
      }
    } catch {}

    // UTM params
    for (const key of UTM_KEYS) {
      try {
        const val = url.searchParams.get(key)?.trim()
        const storageKey = `${STORAGE_KEYS.utm_prefix}${key}`
        if (val && !window.localStorage.getItem(storageKey)) {
          window.localStorage.setItem(storageKey, val)
        }
      } catch {}
    }

    // Common ad click identifiers
    try {
      const gclid = url.searchParams.get("gclid")?.trim()
      if (gclid && !window.localStorage.getItem(STORAGE_KEYS.gclid)) {
        window.localStorage.setItem(STORAGE_KEYS.gclid, gclid)
      }
    } catch {}
    try {
      const fbclid = url.searchParams.get("fbclid")?.trim()
      if (fbclid && !window.localStorage.getItem(STORAGE_KEYS.fbclid)) {
        window.localStorage.setItem(STORAGE_KEYS.fbclid, fbclid)
      }
    } catch {}
  } catch {}
}

/**
 * Return normalized client-side tracking payload, pulling from first-touch storage
 * when available and falling back to current page signals.
 */
export function getClientTracking(): ClientTrackingPayload {
  const out: ClientTrackingPayload = {}

  // UTM params
  for (const key of UTM_KEYS) {
    try {
      const storageKey = `${STORAGE_KEYS.utm_prefix}${key}`
      const stored = typeof window !== "undefined" ? window.localStorage?.getItem(storageKey) ?? undefined : undefined
      if (stored) {
        ;(out as any)[key] = stored
      } else if (typeof window !== "undefined") {
        const url = new URL(window.location.href)
        const val = url.searchParams.get(key) ?? undefined
        if (val) (out as any)[key] = val
      }
    } catch {}
  }

  // Referrer and landing
  try {
    if (typeof document !== "undefined") {
      const ref = document.referrer?.trim()
      if (ref) out.referrerUrl = ref
    }
  } catch {}
  try {
    const storedLanding = typeof window !== "undefined" ? window.localStorage?.getItem(STORAGE_KEYS.landingUrl) ?? undefined : undefined
    out.landingUrl = storedLanding || (typeof window !== "undefined" ? window.location.href : undefined)
  } catch {
    if (typeof window !== "undefined") out.landingUrl = window.location.href
  }

  // IDs: gclid / fbclid from storage or URL
  try {
    const gclid = typeof window !== "undefined" ? window.localStorage?.getItem(STORAGE_KEYS.gclid) ?? undefined : undefined
    if (gclid) out.gclid = gclid
    else if (typeof window !== "undefined") out.gclid = new URL(window.location.href).searchParams.get("gclid") ?? undefined
  } catch {}
  try {
    const fbclid = typeof window !== "undefined" ? window.localStorage?.getItem(STORAGE_KEYS.fbclid) ?? undefined : undefined
    if (fbclid) out.fbclid = fbclid
    else if (typeof window !== "undefined") out.fbclid = new URL(window.location.href).searchParams.get("fbclid") ?? undefined
  } catch {}

  // TikTok + Meta IDs via dedicated helpers (best-effort)
  try {
    const t = getTikTokAttribution()
    if (t?.ttclid) out.ttclid = t.ttclid
  } catch {}
  try {
    const m = getMetaAttribution()
    if (m?.fbp) out.fbp = m.fbp
    if (m?.fbc) out.fbc = m.fbc
  } catch {}

  return out
}
