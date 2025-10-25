const MAX_RECURSION_DEPTH = 3

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function parseAspectRatioString(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.includes(":")) {
    const [w, h] = trimmed.split(":").map((part) => Number.parseFloat(part))
    if (isPositiveFiniteNumber(w) && isPositiveFiniteNumber(h)) {
      return w / h
    }
    return undefined
  }
  const parsed = Number.parseFloat(trimmed)
  return isPositiveFiniteNumber(parsed) ? parsed : undefined
}

export function parseAspectRatio(raw: unknown): number | undefined {
  if (isPositiveFiniteNumber(raw)) return raw
  if (typeof raw === "string") return parseAspectRatioString(raw)
  if (raw == null) return undefined
  return undefined
}

function pickNumberFromMap(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (key in source) {
      const value = source[key]
      if (isPositiveFiniteNumber(value)) return value
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value)
        if (isPositiveFiniteNumber(parsed)) return parsed
      }
    }
  }
  return undefined
}

function extractAspectRatioFromObject(candidate: Record<string, unknown>, depth: number): number | undefined {
  const directKeys = ["aspectRatio", "aspect_ratio", "ratio", "ar"]
  for (const key of directKeys) {
    if (key in candidate) {
      const direct = parseAspectRatio(candidate[key])
      if (isPositiveFiniteNumber(direct)) return direct
    }
  }

  const width = pickNumberFromMap(candidate, ["width", "w", "pixelWidth", "imageWidth", "videoWidth"])
  const height = pickNumberFromMap(candidate, ["height", "h", "pixelHeight", "imageHeight", "videoHeight"])
  if (isPositiveFiniteNumber(width) && isPositiveFiniteNumber(height)) {
    return width / height
  }

  if (depth >= MAX_RECURSION_DEPTH) return undefined

  for (const value of Object.values(candidate)) {
    const nested = extractAspectRatioFromMeta(value, depth + 1)
    if (isPositiveFiniteNumber(nested)) return nested
  }
  return undefined
}

export function extractAspectRatioFromMeta(meta: unknown, depth = 0): number | undefined {
  if (meta == null) return undefined

  const parsed = parseAspectRatio(meta)
  if (isPositiveFiniteNumber(parsed)) return parsed

  if (typeof meta === "string") {
    try {
      const parsedJson = JSON.parse(meta)
      return extractAspectRatioFromMeta(parsedJson, depth + 1)
    } catch {
      return undefined
    }
  }

  if (typeof meta === "number") return parseAspectRatio(meta)

  if (Array.isArray(meta)) {
    if (depth >= MAX_RECURSION_DEPTH) return undefined
    for (const item of meta) {
      const nested = extractAspectRatioFromMeta(item, depth + 1)
      if (isPositiveFiniteNumber(nested)) return nested
    }
    return undefined
  }

  if (typeof meta === "object") {
    return extractAspectRatioFromObject(meta as Record<string, unknown>, depth)
  }

  return undefined
}

const aspectRatioCache = new Map<string, number>()

export function rememberAspectRatio(id: string | null | undefined, ratio: number | undefined): void {
  if (!id || !isPositiveFiniteNumber(ratio)) return
  aspectRatioCache.set(id, ratio)
}

export function getCachedAspectRatio(id: string | null | undefined): number | undefined {
  if (!id) return undefined
  return aspectRatioCache.get(id)
}

export function clearAspectRatioCache(ids?: string[]): void {
  if (!ids || ids.length === 0) {
    aspectRatioCache.clear()
    return
  }
  for (const id of ids) {
    aspectRatioCache.delete(id)
  }
}
