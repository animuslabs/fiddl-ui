import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { ref, Ref } from "vue"
import { jwt } from "lib/jwt"
import { AppRouter } from "../../../fiddl-server/src/server"
import ax from "axios"
import superjson from "superjson"
// import { AppRouter } from "./server"
// Set up the API URL
export let apiUrl = import.meta.env.VITE_API_URL || "https://api.fiddl.art"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}
import { inferRouterOutputs, type inferRouterInputs } from "@trpc/server"
import type { CollectionsGetCollectionImagesQueryResult, CreationsUserImagePurchasesQueryResult } from "lib/orval"

console.log("API URL", apiUrl)

export const authToken: Ref<string | null> = ref(null)
const jwtData = jwt.read()
if (jwtData) authToken.value = jwtData.token

const api = createTRPCClient<AppRouter>({
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

export async function uploadTrainingImages(modelid: string, form: FormData, onProgress: (progress: number) => void) {
  const headers = {
    Authorization: `Bearer ${jwt.read()?.token}`,
    modelid,
  }

  try {
    const response = await ax.post(`${apiUrl}/uploadTrainingImages`, form, {
      headers,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100
          onProgress(progress) // Call progress callback
        }
      },
    })

    return response.data // Parse and return the JSON response
  } catch (error) {
    console.error("Upload failed:", error)
    throw error
  }
}

export type UserData = inferRouterOutputs<AppRouter>["user"]["get"]
export type UserProfile = inferRouterOutputs<AppRouter>["user"]["profile"]
export type PointsTransfer = inferRouterOutputs<AppRouter>["user"]["pointsHistory"][number]
// export type ImagePurchase = inferRouterOutputs<AppRouter>["creations"]["userImagePurchases"][number]
export type ImagePurchase = CreationsUserImagePurchasesQueryResult["data"][number]
export type ImageCreateRequest = inferRouterOutputs<AppRouter>["creations"]["createRequest"]
export type ImageData = inferRouterOutputs<AppRouter>["creations"]["imageData"]
export type PromoCode = inferRouterOutputs<AppRouter>["promo"]["getPromoCodeDetails"]
// export type Image = inferRouterOutputs<AppRouter>["collections"]["getCollectionImages"][number]
export type Image = CollectionsGetCollectionImagesQueryResult["data"][number]
export type NotificationConfig = inferRouterOutputs<AppRouter>["user"]["getNotificationConfig"]
export type NotificationConfigSet = inferRouterInputs<AppRouter>["user"]["setNotificationConfig"]
export type PublicProfile = inferRouterOutputs<AppRouter>["user"]["publicProfile"]
export type CustomModelWithRequests = inferRouterOutputs<AppRouter>["models"]["getUserModels"][number]
export type CustomModel = inferRouterOutputs<AppRouter>["models"]["getModel"]
export type TrainingData = inferRouterOutputs<AppRouter>["models"]["getTrainingStatus"]
export type User = inferRouterOutputs<AppRouter>["user"]["allUsers"][number]

// export default api
// export type APIType = typeof api
