import Privy, { type OAuthProviderType } from "@privy-io/js-sdk-core"

import { getAccessToken } from "@privy-io/react-auth"
import { privyAuthenticate } from "lib/orval"
import { throwErr } from "lib/util"
import { Dialog } from "quasar"
console.log("privy client", import.meta.env.VITE_PRIVY_APP_ID)
if (!import.meta.env.VITE_PRIVY_APP_ID) throwErr("VITE_PRIVY_APP_ID is not defined in .env file")
// Initialize Privy with your app ID
export const privy = new Privy({
  appId: import.meta.env.VITE_PRIVY_APP_ID,
  storage: {
    get: (key: string) => localStorage.getItem(key),
    put: (key: string, value: string) => localStorage.setItem(key, value),
    del: (key: string) => localStorage.removeItem(key),
    getKeys: () => Object.keys(localStorage),
  },
})
type PrivyEmailLoginResponse = Awaited<ReturnType<typeof privy.auth.email.loginWithCode>>
export type PrivyAuthenticatedUser = PrivyEmailLoginResponse["user"]
// Define the interface for verification result
export interface PrivyVerificationResult {
  user: PrivyAuthenticatedUser
  isNewUser: boolean
  token: string
}

// Email login
export async function handleEmailLogin(email: string) {
  await privy.auth.email.sendCode(email)
}

export async function verifyEmailCode(email: string, code: string): Promise<PrivyVerificationResult> {
  try {
    await privy.auth.logout().catch((err) => console.error("Failed to logout from Privy:", err))
    const { user, is_new_user, privy_access_token, token } = await privy.auth.email.loginWithCode(email, code)
    if (!token) throw new Error("Failed to get Privy access token")
    return { user, isNewUser: is_new_user || false, token }
  } catch (error: any) {
    Dialog.create({
      title: "Error",
      message: "Failed to verify code: " + error.message,
      ok: {
        label: "OK",
        flat: true,
        color: "primary",
      },
    })
    console.error("Privy email verification error:", error)
    throw error
  }
}

// SMS login
export async function handleSmsLogin(phone: string) {
  await privy.auth.phone.sendCode(phone)
}

export async function verifySmsCode(phone: string, code: string): Promise<PrivyVerificationResult> {
  try {
    await privy.auth.logout().catch((err) => console.error("Failed to logout from Privy:", err))
    const { user, is_new_user, privy_access_token } = await privy.auth.phone.loginWithCode(phone, code)
    if (!privy_access_token) throw new Error("Failed to get Privy access token")
    return { user, isNewUser: is_new_user || false, token: privy_access_token }
  } catch (error) {
    console.error("Privy phone verification error:", error)
    throw error
  }
}

// OAuth login (Google, Discord, etc.)
export async function handleOauthLogin(provider: OAuthProviderType) {
  await privy.auth.logout().catch((err) => console.error("Failed to logout from Privy:", err))
  const oauthUrl = await privy.auth.oauth.generateURL(provider, `${window.location.origin}/auth/callback`)
  window.location.href = oauthUrl.url
}

export async function oauthCallback(code: string, state: string, provider: OAuthProviderType) {
  await privy.auth.logout().catch((err) => console.error("Failed to logout from Privy:", err))
  const { user, is_new_user } = await privy.auth.oauth.loginWithCode(code, state, provider)
  return { user, isNewUser: is_new_user }
}

// Get current user
export async function getPrivyUser() {
  try {
    const result = await privy.user.get()
    return result.user
  } catch (error) {
    console.error("Error getting Privy user:", error)
    return null
  }
}

// Logout
export async function privyLogout() {
  try {
    await privy.auth.logout()
  } catch (error) {
    console.error("Error logging out from Privy:", error)
  }
}

export async function authenticateWithServer(accessToken: string, referrerUsername?: string) {
  // Call the server's authenticate endpoint
  const response = await privyAuthenticate({
    accessToken,
    referrerUsername,
  })
  const result = response.data
  return result
}
