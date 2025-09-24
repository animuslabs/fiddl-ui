// Minimal wrapper around Telegram Mini Apps Analytics custom event transport.
// - No-ops when not in Telegram WebApp (TMA)
// - Uses Telegram.WebView.postEvent('custom-event', { ... }) when available
// - Falls back to window.parent.postMessage(JSON.stringify({ eventType, eventData }))

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

function inTma(): boolean {
  try {
    if (typeof window === "undefined") return false
    // Flag set by src/boot/tma.ts
    if ((window as any).__TMA__?.enabled) return true
    // Native Telegram WebApp detection
    if ((window as any)?.Telegram?.WebApp) return true
    return false
  } catch {
    return false
  }
}

function postCustomEvent(event: string, data?: Record<string, Json>) {
  if (!inTma()) return
  const payload = { name: event, ...(data || {}) }
  try {
    const w = window as any
    const webView = w?.Telegram?.WebView
    if (webView && typeof webView.postEvent === "function") {
      // Prefer Telegram WebView transport
      webView.postEvent("custom-event", payload)
      return
    }
  } catch {}
  try {
    // Fallback to postMessage bus used by the SDK
    const msg = JSON.stringify({ eventType: "custom-event", eventData: payload })
    window.parent?.postMessage(msg, "*")
  } catch {}
}

export const tmaAnalytics = {
  enabled: () => inTma(),
  event: postCustomEvent,

  // High-level helpers (keep names concise and kebab-case in analytics)
  createStart(kind: "image" | "video", meta?: Record<string, Json>) {
    postCustomEvent("create-start", { kind, ...meta })
  },
  createSuccess(kind: "image" | "video", meta?: Record<string, Json>) {
    postCustomEvent("create-success", { kind, ...meta })
  },
  upvote(mediaId: string, mediaType: "image" | "video") {
    postCustomEvent("upvote", { mediaId, mediaType })
  },
  like(mediaId: string, mediaType: "image" | "video") {
    postCustomEvent("like", { mediaId, mediaType })
  },
  unlike(mediaId: string, mediaType: "image" | "video") {
    postCustomEvent("unlike", { mediaId, mediaType })
  },
  comment(mediaId: string, mediaType: "image" | "video", contentLength?: number) {
    postCustomEvent("comment", { mediaId, mediaType, contentLength: contentLength ?? null })
  },
  purchaseIntent(method: "paypal" | "crypto" | "stars", fields: Record<string, Json>) {
    postCustomEvent("purchase-intent", { method, ...fields })
  },
  purchaseSuccess(method: "paypal" | "crypto" | "stars", fields: Record<string, Json>) {
    postCustomEvent("purchase-success", { method, ...fields })
  },
}

export default tmaAnalytics

