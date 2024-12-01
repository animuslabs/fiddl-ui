import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import { ref, Ref } from "vue"
import { jwt } from "lib/jwt"
import { AppRouter } from "fiddl-server/dist/server"
import superjson from "superjson"
// import { AppRouter } from "./server"
// Set up the API URL
export let apiUrl = process.env.API_URL || "https://api.fiddl.art"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}
import { inferRouterOutputs, type inferRouterInputs } from "@trpc/server"

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

export async function uploadTrainingImages(modelid: string, form: FormData) {
  const headers = {
    Authorization: `Bearer ${jwt.read()?.token}`,
    modelid,
  }

  try {
    const response = await fetch(`${apiUrl}/uploadTrainingImages`, {
      method: "POST",
      headers,
      body: form,
    })

    if (!response.ok) {
      // Handle HTTP errors
      const errorData = await response.json()
      throw new Error(errorData.error || "File upload failed")
    }

    // Parse and return the JSON response
    const result = await response.json()
    return result
  } catch (error) {
    // Handle errors (network issues, server errors, etc.)
    console.error("Upload failed:", error)
    throw error // Rethrow to handle errors where this function is called
  }
}

export type UserData = inferRouterOutputs<AppRouter>["user"]["get"]
export type UserProfile = inferRouterOutputs<AppRouter>["user"]["profile"]
export type PointsTransfer = inferRouterOutputs<AppRouter>["user"]["pointsHistory"][number]
export type ImagePurchase = inferRouterOutputs<AppRouter>["creations"]["userImagePurchases"][number]
export type ImageCreateRequest = inferRouterOutputs<AppRouter>["creations"]["createRequest"]
export type ImageData = inferRouterOutputs<AppRouter>["creations"]["imageData"]
export type PromoCode = inferRouterOutputs<AppRouter>["promo"]["getPromoCodeDetails"]
export type Image = inferRouterOutputs<AppRouter>["collections"]["getCollectionImages"][number]
export type NotificationConfig = inferRouterOutputs<AppRouter>["user"]["getNotificationConfig"]
export type NotificationConfigSet = inferRouterInputs<AppRouter>["user"]["setNotificationConfig"]
export type PublicProfile = inferRouterOutputs<AppRouter>["user"]["publicProfile"]
export type CustomModelWithRequests = inferRouterOutputs<AppRouter>["models"]["getUserModels"][number]
export type CustomModel = inferRouterOutputs<AppRouter>["models"]["getModel"]
export type TrainingData = inferRouterOutputs<AppRouter>["models"]["getTrainingStatus"]
export type User = inferRouterOutputs<AppRouter>["user"]["allUsers"][number]
export default api
export type APIType = typeof api
