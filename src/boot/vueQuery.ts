// src/boot/vue-query.ts
import { boot } from "quasar/wrappers"
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query"
import axios from "axios"
import { jwt } from "src/lib/jwt"

// Set up the API URL (similar to your current api.ts)
export let apiUrl = (import.meta.env.VITE_API_URL || "https://api.fiddl.art") + "/api"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}

// Configure axios
axios.defaults.baseURL = apiUrl
axios.defaults.timeout = 0

// Add auth interceptor for JWT
axios.interceptors.request.use((config) => {
  const jwtData = jwt.read()
  if (jwtData) {
    config.headers.Authorization = `Bearer ${jwtData.token}`
  }
  return config
})

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
