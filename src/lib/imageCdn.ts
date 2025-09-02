import { creationsImageSecret, creationsHdImage } from "src/lib/orval"

const S3 = import.meta.env.VITE_S3_URL as string

const SECRET_PREFIX = "imgSecret:"
const inFlight: Map<string, Promise<string>> = new Map()

function cacheKey(imageId: string) {
  return `${SECRET_PREFIX}${imageId}`
}

export function getCachedSecret(imageId: string): string | null {
  try {
    return localStorage.getItem(cacheKey(imageId))
  } catch {
    return null
  }
}

export function setCachedSecret(imageId: string, secret: string) {
  try {
    localStorage.setItem(cacheKey(imageId), secret)
  } catch {}
}

export function clearImageSecretCache(imageId?: string) {
  try {
    if (imageId) {
      localStorage.removeItem(cacheKey(imageId))
      return
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(SECRET_PREFIX)) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
}

export async function getImageSecret(imageId: string): Promise<string> {
  const cached = getCachedSecret(imageId)
  if (cached) return cached

  const existing = inFlight.get(imageId)
  if (existing) return existing

  const p = (async () => {
    const { data } = await creationsImageSecret({ imageId })
    const secret = data
    if (secret) setCachedSecret(imageId, secret)
    inFlight.delete(imageId)
    return secret
  })()

  inFlight.set(imageId, p)
  return p
}

export function compressedUrl(imageId: string, size: "sm" | "md" | "lg"): string {
  return `${S3}/compressedImages/${imageId}-${size}.webp`
}

export async function hdUrl(imageId: string): Promise<string> {
  const secret = await getImageSecret(imageId)
  return `${S3}/hdImages/${imageId}-${secret}-hd.webp`
}

export async function originalDownloadUrl(imageId: string): Promise<string> {
  const secret = await getImageSecret(imageId)
  return `${S3}/originalImages/${imageId}-${secret}-original.png`
}

export async function upscaledUrl(imageId: string): Promise<string> {
  const secret = await getImageSecret(imageId)
  return `${S3}/upscaledImages/${imageId}-${secret}-upscaled.png`
}

// Optional: server-proxied HD download URL (if needed)
export async function hdDownloadUrl(imageId: string): Promise<string> {
  const { data } = await creationsHdImage({ imageId, download: true as any })
  return data
}

