// src/boot/vue-query.ts
import { boot } from "quasar/wrappers"
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query"
import axios from "axios"
import { jwt } from "src/lib/jwt"
import { useUserAuth } from "src/stores/userAuth"
import { Notify } from "quasar"

// Set up the API URL (similar to your current api.ts)
export let apiUrl = (import.meta.env.VITE_API_URL || "https://api.fiddl.art") + "/api"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}

// Configure axios
axios.defaults.baseURL = apiUrl
axios.defaults.timeout = 0

// Track whether we've already notified about an expired session
let hasNotifiedExpiry = false

// Add auth interceptor for JWT and handle pre-flight expiry
axios.interceptors.request.use((config) => {
  // Proactively logout if token is expired
  if (jwt.isExpired()) {
    const auth = useUserAuth()
    if (auth.loggedIn) auth.logout()
    if (!hasNotifiedExpiry) {
      hasNotifiedExpiry = true
      Notify.create({ message: "Your session has expired. Please log in again.", color: "warning", icon: "logout" })
    }
    // Reject the request since the token is invalid
    return Promise.reject(new Error("JWT expired; user logged out"))
  }

  const jwtData = jwt.read()
  if (jwtData) {
    config.headers.Authorization = `Bearer ${jwtData.token}`
  }
  return config
})

// Global response interceptor to catch 401s (expired/invalid token)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      const auth = useUserAuth()
      if (auth.loggedIn) auth.logout()
      if (!hasNotifiedExpiry) {
        hasNotifiedExpiry = true
        Notify.create({ message: "Your session has expired. Please log in again.", color: "warning", icon: "logout" })
      }
    }
    return Promise.reject(error)
  },
)

// Create the query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

export default boot(({ app }) => {
  // Install the Vue Query plugin
  app.use(VueQueryPlugin, {
    queryClient,
  })
})
