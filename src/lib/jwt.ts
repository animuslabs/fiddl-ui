const TOKEN_STORAGE_KEY = "jwtToken"
import { LocalStorage } from "quasar"

type SavedJwt = { userId: string; token: string }

function decodeBase64Url(input: string) {
  // Convert base64url to base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  // Pad string with '=' to make length multiple of 4
  while (base64.length % 4) base64 += "="
  try {
    return atob(base64)
  } catch {
    // Fallback for older environments
    return Buffer.from(base64, "base64").toString("binary")
  }
}

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const json = decodeBase64Url(parts[1]!)
    // JWT payload is JSON; base64url decode is sufficient for typical ASCII payloads
    return JSON.parse(json)
  } catch {
    return null
  }
}

function getExpiryMs(token: string): number | null {
  const payload = parseJwtPayload(token)
  if (!payload) return null
  const exp = payload.exp
  if (typeof exp === "number") return exp * 1000
  return null
}

export const jwt = {
  read(): SavedJwt | null {
    return LocalStorage.getItem<SavedJwt>(TOKEN_STORAGE_KEY)
  },
  save(data: SavedJwt) {
    LocalStorage.set(TOKEN_STORAGE_KEY, data)
  },
  remove() {
    LocalStorage.remove(TOKEN_STORAGE_KEY)
  },
  // Returns true if token exists and is past its `exp` claim
  isExpired(): boolean {
    const saved = this.read()
    if (!saved?.token) return false
    const expMs = getExpiryMs(saved.token)
    if (!expMs) return false
    return Date.now() >= expMs
  },
  // Milliseconds remaining until expiry; null if unknown
  msUntilExpiry(): number | null {
    const saved = this.read()
    if (!saved?.token) return null
    const expMs = getExpiryMs(saved.token)
    if (!expMs) return null
    return expMs - Date.now()
  },
}

export const jwtUtil = { parseJwtPayload, getExpiryMs }
