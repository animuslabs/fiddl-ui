import Privy, { type OAuthProviderType } from "@privy-io/js-sdk-core"

// Initialize Privy with your app ID
export const privy = new Privy({
  appId: import.meta.env.VITE_PRIVY_APP_ID || "",
  storage: {
    get: (key: string) => localStorage.getItem(key),
    put: (key: string, value: string) => localStorage.setItem(key, value),
    del: (key: string) => localStorage.removeItem(key),
    getKeys: () => Object.keys(localStorage),
  },
})

// Email login
export async function handleEmailLogin(email: string) {
  await privy.auth.email.sendCode(email)
}

export async function verifyEmailCode(email: string, code: string) {
  const { user, is_new_user } = await privy.auth.email.loginWithCode(email, code)
  return { user, isNewUser: is_new_user }
}

// SMS login
export async function handleSmsLogin(phone: string) {
  await privy.auth.phone.sendCode(phone)
}

export async function verifySmsCode(phone: string, code: string) {
  const { user, is_new_user } = await privy.auth.phone.loginWithCode(phone, code)
  return { user, isNewUser: is_new_user }
}

// OAuth login (Google, Discord, etc.)
export async function handleOauthLogin(provider: OAuthProviderType) {
  const oauthUrl = await privy.auth.oauth.generateURL(provider, `${window.location.origin}/auth/callback`)
  window.location.href = oauthUrl.url
}

export async function oauthCallback(code: string, state: string, provider: OAuthProviderType) {
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
