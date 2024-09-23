import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import { ref, Ref } from "vue"
import { jwt } from "lib/jwt"
import { AppRouter } from "fiddl-server/dist/server"
import superjson from "superjson"
// import { AppRouter } from "./server"
// Set up the API URL
export let apiUrl = process.env.API_URL || "localhost:4444"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}
import { inferRouterOutputs } from "@trpc/server"

console.log("API URL", apiUrl)

export const authToken: Ref<string | null> = ref(null)
const jwtData = jwt.read()
if (jwtData) authToken.value = jwtData.token

const api = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
      headers() {
        const jwtData = jwt.read()
        if (jwtData) {
          authToken.value = jwtData.token
          return {
            Authorization: `Bearer ${jwtData.token}`,
          }
        }
        return {}
      },
    }),
  ],
})
export type UserData = inferRouterOutputs<AppRouter>["user"]["get"]

export default api
export type APIType = typeof api
