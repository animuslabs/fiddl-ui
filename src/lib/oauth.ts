import { apiUrl } from "lib/api"
import { jwt } from "lib/jwt"
import { getReferredBy } from "lib/util"
import { getMetaAttribution } from "./metaAttribution"
import {
  loginLinkInitLoginLink,
  loginLinkLoginWithCode,
  userOauthLinkStartUrl,
  userUnlinkOAuth,
  type LoginLinkLoginWithLink200,
  type UserOauthLinkStartUrlParams,
  UserUnlinkOAuthBodyProvider,
} from "lib/orval"

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

function detectBraveSync(): boolean {
  try {
    // Quick sync heuristics (works on Desktop Brave; iOS may not expose navigator.brave)
    // We avoid awaiting isBrave() to keep the public API synchronous.
    // If this returns false negatives, the server-side token injection still helps.
     
    const nav: any = navigator
    if (nav?.brave) return true
    const ua = String(navigator.userAgent || "")
    return /Brave/i.test(ua)
  } catch {
    return false
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

  // For Brave firewall / strict privacy browsers, prefer a direct navigation
  // to the API start endpoint so any server cookies are set in a first-party context.
  if ((options.mode ?? "login") === "link" && detectBraveSync()) {
    const callbackUrl = new URL(`/auth/callback/${callbackSegment}`, window.location.origin)
    if (returnTo) callbackUrl.searchParams.set("returnTo", returnTo)

    const requestUrl = new URL(`${apiUrl}/auth/oauth/${providerKey}/start`)
    requestUrl.searchParams.set("mode", "link")
    requestUrl.searchParams.set("redirect", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`)
    const referrer = getReferredBy()
    if (referrer) requestUrl.searchParams.set("referrer", referrer)
    // Attach Meta attribution for reliability across domains
    try {
      const { fbp, fbc } = getMetaAttribution()
      const fbclid = new URL(window.location.href).searchParams.get("fbclid") || undefined
      if (fbp) requestUrl.searchParams.set("fbp", fbp)
      if (fbc) requestUrl.searchParams.set("fbc", fbc)
      if (fbclid) requestUrl.searchParams.set("fbclid", fbclid)
    } catch {}
    try {
      const auth = jwt.read()
      if (auth?.token) {
        requestUrl.searchParams.set("token", auth.token)
        requestUrl.searchParams.set("authorization", `Bearer ${auth.token}`)
        requestUrl.searchParams.set("userId", auth.userId)
      }
    } catch {}
    window.location.href = requestUrl.toString()
    return
  }

  // New orval route for LINK mode. Server returns a fully-qualified URL.
  if ((options.mode ?? "login") === "link") {
    const apiProvider = provider === "twitter" ? ("x" as UserOauthLinkStartUrlParams["provider"]) : "google"
    const redirect = returnTo || "/settings"
    const params: UserOauthLinkStartUrlParams = { provider: apiProvider, redirect }
    const referrer = getReferredBy()
    if (referrer) params.referrer = referrer
    // Fire request; then navigate the browser to the returned URL
    void userOauthLinkStartUrl({ ...params, response_format: "json" })
      .then((res) => {
        let url = res?.data?.url
        if (!url) throw new Error("Invalid response: missing url")
        // If backend returns an internal start URL that still requires auth,
        // append the JWT as query parameters to avoid 401 on cross-domain nav.
        try {
          const u = new URL(url, window.location.origin)
          const isInternalStart = /\/auth\/oauth\//.test(u.pathname)
          const hasToken = u.searchParams.has("token") || u.searchParams.has("authorization")
          if (isInternalStart && !hasToken) {
            const auth = jwt.read()
            if (auth?.token) {
              u.searchParams.set("token", auth.token)
              u.searchParams.set("authorization", `Bearer ${auth.token}`)
              u.searchParams.set("userId", auth.userId)
              // Attach Meta attribution parameters as well
              try {
                const { fbp, fbc } = getMetaAttribution()
                const fbclid = new URL(window.location.href).searchParams.get("fbclid") || undefined
                if (fbp && !u.searchParams.has("fbp")) u.searchParams.set("fbp", fbp)
                if (fbc && !u.searchParams.has("fbc")) u.searchParams.set("fbc", fbc)
                if (fbclid && !u.searchParams.has("fbclid")) u.searchParams.set("fbclid", fbclid)
              } catch {}
              url = u.toString()
            }
          }
        } catch {}
        window.location.href = url
      })
      .catch((e) => {
        // Surface the error in console; caller usually wraps with catchErr
        console.error("Failed to start OAuth link:", e)
      })
    return
  }

  const callbackUrl = new URL(`/auth/callback/${callbackSegment}`, window.location.origin)
  if (returnTo) callbackUrl.searchParams.set("returnTo", returnTo)

  const requestUrl = new URL(`${apiUrl}/auth/oauth/${providerKey}/start`)
  requestUrl.searchParams.set("mode", options.mode ?? "login")
  requestUrl.searchParams.set("redirect", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`)
  const referrer = getReferredBy()
  if (referrer) requestUrl.searchParams.set("referrer", referrer)
  // Attach Meta attribution parameters (best-effort)
  try {
    const { fbp, fbc } = getMetaAttribution()
    const fbclid = new URL(window.location.href).searchParams.get("fbclid") || undefined
    if (fbp) requestUrl.searchParams.set("fbp", fbp)
    if (fbc) requestUrl.searchParams.set("fbc", fbc)
    if (fbclid) requestUrl.searchParams.set("fbclid", fbclid)
  } catch {}

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
  // Use new Orval route; map twitter->x
  const apiProvider: UserUnlinkOAuthBodyProvider = provider === "twitter" ? "x" : "google"
  try {
    await userUnlinkOAuth({ provider: apiProvider })
    return
  } catch (err) {
    // Fallback to legacy endpoint if server is older
    try {
      const providerKey = provider === "twitter" ? "twitter" : "google"
      const endpoint = `${apiUrl}/auth/oauth/${providerKey}/unlink`
      const auth = jwt.read()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`
      const res = await fetch(endpoint, { method: "POST", headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      throw err
    }
  }
}
