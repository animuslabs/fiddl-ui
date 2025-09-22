const TOKEN_KEYS = ["token", "loginLink", "payload"] as const

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function findTokenInSearchParams(search: string): string | null {
  if (!search.includes("=")) return null
  try {
    const params = new URLSearchParams(search)
    for (const key of TOKEN_KEYS) {
      const value = params.get(key)
      if (value) return decodeValue(value.trim())
    }
  } catch {}
  return null
}

/**
 * Extracts the login token from a variety of possible formats returned from the backend.
 * Accepts either the raw token, a full login URL, or query-string encoded payloads.
 */
export function extractLoginToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      for (const key of TOKEN_KEYS) {
        const value = url.searchParams.get(key)
        if (value) return decodeValue(value.trim())
      }
    } catch {}
  }

  const parts = new Set<string>()
  parts.add(trimmed)
  const questionIndex = trimmed.indexOf("?")
  if (questionIndex >= 0 && questionIndex < trimmed.length - 1) {
    parts.add(trimmed.slice(questionIndex + 1))
  }

  for (const part of parts) {
    const token = findTokenInSearchParams(part)
    if (token) return token
  }

  const inlineMatch = trimmed.match(/(?:token|loginLink|payload)=([^&\s]+)/i)
  if (inlineMatch?.[1]) {
    return decodeValue(inlineMatch[1])
  }

  return trimmed
}

export function pickFirstLoginTokenCandidate(values: Array<unknown>): string | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      const token = pickFirstLoginTokenCandidate(value)
      if (token) return token
      continue
    }
    const token = extractLoginToken(value)
    if (token) return token
  }
  return null
}
