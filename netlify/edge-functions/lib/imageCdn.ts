import { creationsImageSecret, creationsHdImage } from "./orval.ts"

const env = Netlify.env.toObject()
const S3 = env.VITE_S3_URL as string

// Simple in-memory cache for secrets within a single Edge function instance
const secretsCache: Map<string, string> = new Map()
const inFlight: Map<string, Promise<string>> = new Map()

async function getImageSecret(imageId: string): Promise<string> {
  const cached = secretsCache.get(imageId)
  if (cached) return cached

  const existing = inFlight.get(imageId)
  if (existing) return existing

  const p = (async () => {
    try {
      const secret = await creationsImageSecret({ imageId })
      if (secret) secretsCache.set(imageId, secret)
      return secret
    } finally {
      inFlight.delete(imageId)
    }
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

export async function hdDownloadUrl(imageId: string): Promise<string> {
  return creationsHdImage({ imageId, download: true as any })
}

