// Lightweight DataFast wrapper with SSR safety and payload sanitation
// Docs reference: custom goals and identify

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

const isBrowser = typeof window !== "undefined"

function getDf(): ((...args: any[]) => void) | undefined {
  if (!isBrowser) return undefined
  // If queue stub exists, use it; otherwise noop
  return (window as any).datafast as any
}

function toSnakeCase(key: string): string {
  // camelCase -> snake_case, then enforce allowed charset
  const snake = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase()
  return snake.replace(/[^a-z0-9_-]/g, "")
}

function sanitizeEventName(name: string): string {
  let n = (name || "").trim()
  if (!n) return "event"
  // Convert camelCase and spaces to snake_case
  n = toSnakeCase(n)
  // Enforce length <= 32
  if (n.length > 32) n = n.slice(0, 32)
  if (!n) n = "event"
  return n
}

function truncate255(v: string): string {
  return v.length > 255 ? v.slice(0, 255) : v
}

function simplifyValue(value: any): string {
  if (value == null) return ""
  if (typeof value === "string") return truncate255(value)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    // If array of primitives, join; if array of objects with id, join ids
    const arr = value as any[]
    if (arr.length && typeof arr[0] === "object" && arr[0] && "id" in (arr[0] as any)) {
      const ids = arr.map((it) => String((it && (it as any).id) ?? "")).filter(Boolean)
      return truncate255(ids.join(","))
    }
    return truncate255(arr.map((x) => String(x ?? "")).join(","))
  }
  try {
    return truncate255(JSON.stringify(value))
  } catch {
    return ""
  }
}

function sanitizeParams(input?: Record<string, any>): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined
  const out: Record<string, string> = {}

  // Special-case common ecommerce shapes to keep params simple
  if (Array.isArray((input as any).contents)) {
    const ids = ((input as any).contents as any[])
      .map((c) => (c && (c as any).id != null ? String((c as any).id) : ""))
      .filter(Boolean)
    if (ids.length) out["content_ids"] = truncate255(ids.join(","))
  }

  // Copy and sanitize up to 10 keys
  const keys = Object.keys(input)
  for (const k of keys) {
    if (k === "contents") continue // replaced by content_ids above
    const sk = toSnakeCase(k)
    if (!sk) continue
    if (Object.prototype.hasOwnProperty.call(out, sk)) continue
    out[sk] = simplifyValue((input as any)[k])
    if (Object.keys(out).length >= 10) break
  }
  return Object.keys(out).length ? out : undefined
}

export const datafast = {
  goal(eventName: string, params?: Record<string, any>): void {
    if (!isBrowser) return
    const df = getDf()
    if (!df) return
    const name = sanitizeEventName(eventName)
    const meta = sanitizeParams(params)
    try {
      if (meta) df(name, meta)
      else df(name)
    } catch {
      /* no-op */
    }
  },

  identify(params: { user_id: string; name?: string; image?: string } & Record<string, any>): void {
    if (!isBrowser) return
    const df = getDf()
    if (!df) return
    const p: Record<string, string> = {}
    if (params?.user_id) p.user_id = truncate255(String(params.user_id))
    if (params?.name) p.name = truncate255(String(params.name))
    if (params?.image) p.image = truncate255(String(params.image))
    // Copy extra fields (sanitized)
    const extras = sanitizeParams(params)
    if (extras) {
      for (const [k, v] of Object.entries(extras)) {
        if (k === "user_id" || k === "name" || k === "image") continue
        p[k] = v
      }
    }
    try {
      df("identify", p)
    } catch {
      /* no-op */
    }
  },
}

export default datafast

