import ax from "axios"
import { jwt } from "lib/jwt"
import type {
  CollectionsGetCollectionImagesQueryResult,
  CreationsCreateRequestQueryResult,
  CreationsImageDataQueryResult,
  CreationsUserImagePurchasesQueryResult,
  ModelsGetModelQueryResult,
  ModelsGetTrainingStatusQueryResult,
  ModelsGetUserModelsQueryResult,
  PromoGetPromoCodeDetailsQueryResult,
  UserAllUsersQueryResult,
  UserGetNotificationConfigQueryResult,
  UserGetQueryResult,
  UserPointsHistoryQueryResult,
  UserProfileQueryResult,
  UserPublicProfileQueryResult,
  UserSetNotificationConfigMutationResult,
} from "lib/orval"
import { ref, Ref } from "vue"

export let apiUrl = import.meta.env.VITE_API_URL || "https://api.fiddl.art"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}

console.log("API URL", apiUrl)

export const authToken: Ref<string | null> = ref(null)
const jwtData = jwt.read()
if (jwtData) authToken.value = jwtData.token

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

export type UserData = UserGetQueryResult["data"]
export type UserProfile = UserProfileQueryResult["data"]
export type PointsTransfer = UserPointsHistoryQueryResult["data"][number]
export type ImagePurchase = CreationsUserImagePurchasesQueryResult["data"][number]
export type ImageCreateRequest = CreationsCreateRequestQueryResult["data"]
export type ImageData = CreationsImageDataQueryResult["data"]
export type PromoCode = PromoGetPromoCodeDetailsQueryResult["data"]
export type Image = CollectionsGetCollectionImagesQueryResult["data"][number]
export type NotificationConfig = UserGetNotificationConfigQueryResult["data"]
export type NotificationConfigSet = UserSetNotificationConfigMutationResult["data"]
export type PublicProfile = UserPublicProfileQueryResult["data"]
export type CustomModelWithRequests = ModelsGetUserModelsQueryResult["data"][number]
export type CustomModel = ModelsGetModelQueryResult["data"]
export type TrainingData = ModelsGetTrainingStatusQueryResult["data"]
export type User = UserAllUsersQueryResult["data"][number]
