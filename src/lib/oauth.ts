import { apiUrl } from "lib/api"
import { jwt } from "lib/jwt"
import { getReferredBy } from "lib/util"
import { loginLinkInitLoginLink, loginLinkLoginWithCode, type LoginLinkLoginWithLink200 } from "lib/orval"

export type OAuthProvider = "google" | "twitter"

export interface StartOAuthOptions {
  mode?: "login" | "link"
  returnTo?: string | null
}

const CALLBACK_PATH_MAP: Record<OAuthProvider, string> = {
  google: "google",
  twitter: "twitter",
}

function sanitizeReturnToPath(input?: string | null): string {
  if (typeof window === "undefined") return "/"
  if (!input) return "/"
  const trimmed = input.trim()
  if (!trimmed) return "/"

  try {
    const base = new URL(window.location.origin)
    const candidate = new URL(trimmed, window.location.origin)
    if (candidate.origin !== base.origin) return "/"
    const path = `${candidate.pathname}${candidate.search}${candidate.hash}`
    return path || "/"
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  }
}

export async function requestEmailLoginCode(email: string): Promise<string> {
  const { data } = await loginLinkInitLoginLink({
    email,
    referredBy: getReferredBy(),
  })
  return data
}

export async function completeEmailLoginWithCode(code: string): Promise<LoginLinkLoginWithLink200> {
  const normalized = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase()
  const { data } = await loginLinkLoginWithCode({ code: normalized })
  return data
}

export function startOAuthLogin(provider: OAuthProvider, options: StartOAuthOptions = {}): void {
  if (typeof window === "undefined") {
    throw new Error("startOAuthLogin can only be called in a browser context")
  }

  const providerKey = provider === "twitter" ? "twitter" : "google"
  const callbackSegment = CALLBACK_PATH_MAP[provider]

  // Respect explicit null (no returnTo) vs. undefined (use current path)
  const requestedReturnTo =
    options.returnTo === undefined ? `${window.location.pathname}${window.location.search}` : options.returnTo
  const returnTo = typeof requestedReturnTo === "string" ? sanitizeReturnToPath(requestedReturnTo) : null
  if (returnTo) {
    sessionStorage.setItem("returnTo", returnTo)
  } else {
    sessionStorage.removeItem("returnTo")
  }

  const callbackUrl = new URL(`/auth/callback/${callbackSegment}`, window.location.origin)
  if (returnTo) callbackUrl.searchParams.set("returnTo", returnTo)

  const requestUrl = new URL(`${apiUrl}/auth/oauth/${providerKey}/start`)
  requestUrl.searchParams.set("mode", options.mode ?? "login")
  requestUrl.searchParams.set("redirect", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`)
  const referrer = getReferredBy()
  if (referrer) requestUrl.searchParams.set("referrer", referrer)

  window.location.href = requestUrl.toString()
}

export function getProviderLabel(provider: OAuthProvider): string {
  return provider === "twitter" ? "X" : "Google"
}

/**
 * Attempt to unlink an OAuth provider from the current user.
 * Backend recently added unlink routes; we call them directly.
 * Falls back between POST and DELETE to be resilient to backend method choice.
 */
export async function unlinkOAuthProvider(provider: OAuthProvider): Promise<void> {
  const providerKey = provider === "twitter" ? "twitter" : "google"
  const endpoint = `${apiUrl}/auth/oauth/${providerKey}/unlink`
  const auth = jwt.read()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`

  // Prefer POST, fallback to DELETE for older servers
  const tryRequest = async (method: "POST" | "DELETE") => {
    const res = await fetch(endpoint, { method, headers })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Unlink failed (${method}): ${res.status} ${text}`)
    }
  }

  try {
    await tryRequest("POST")
  } catch (e) {
    await tryRequest("DELETE")
  }
}
