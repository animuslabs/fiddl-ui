import ax from "axios"
import { jwt } from "lib/jwt"
import type {
  CollectionsGetCollectionImagesQueryResult,
  CollectionsGetCollectionVideosQueryResult,
  CreationsGetImageRequestQueryResult,
  CreationsGetVideoRequestQueryResult,
  CreationsGetCreationDataQueryResult,
  CreationsUserImagePurchasesQueryResult,
  CreationsUserVideoPurchasesQueryResult,
  ModelsGetTrainingStatusQueryResult,
  ModelsGetUserModelsQueryResult,
  PromoGetPromoCodeDetailsQueryResult,
  TrainingSetsGetSetQueryResult,
  UserAllUsersQueryResult,
  UserGetNotificationConfigQueryResult,
  UserGetQueryResult,
  UserPointsHistoryQueryResult,
  UserProfileQueryResult,
  UserPublicProfileQueryResult,
  UserSetNotificationConfigMutationResult,
  ModelsGetCustomModel200,
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
export type VideoPurchase = CreationsUserVideoPurchasesQueryResult["data"][number]
export type ImageData = CreationsGetCreationDataQueryResult["data"]
export type PromoCode = PromoGetPromoCodeDetailsQueryResult["data"]
export type Image = CollectionsGetCollectionImagesQueryResult["data"][number]
export type Video = CollectionsGetCollectionVideosQueryResult["data"][number]
export type NotificationConfig = UserGetNotificationConfigQueryResult["data"]
export type NotificationConfigSet = UserSetNotificationConfigMutationResult["data"]
export type PublicProfile = UserPublicProfileQueryResult["data"]
export type CustomModelWithRequests = ModelsGetUserModelsQueryResult["data"][number]
export type CustomModel = ModelsGetCustomModel200
export type TrainingData = ModelsGetTrainingStatusQueryResult["data"]
export type User = UserAllUsersQueryResult["data"][number]
export type TrainingSet = TrainingSetsGetSetQueryResult["data"]

export async function uploadToPresignedPost({
  file,
  presignedPost,
}: {
  file: Blob
  presignedPost: {
    url: string
    fields: Record<string, string>
  }
}) {
  console.log(presignedPost.fields)
  const formData = new FormData()

  // Add the signed fields first
  Object.entries(presignedPost.fields).forEach(([key, value]) => {
    formData.append(key, value)
  })

  // Then add the actual file (field name must be "file")
  formData.append("file", file)

  const res = await fetch(presignedPost.url, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    console.log(res)
    throw new Error(`Upload failed: ${res.status} ${res.statusText} — ${text}`)
  }

  return true
}
function openXmlDebugTab(xmlString: string) {
  const blob = new Blob([xmlString], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
}
export function uploadWithProgress({
  file,
  presignedPost,
  onProgress,
}: {
  file: Blob
  presignedPost: {
    url: string
    fields: Record<string, string>
  }
  onProgress?: (percent: number) => void
}): Promise<void> {
  console.log(presignedPost.fields)
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    Object.entries(presignedPost.fields).forEach(([k, v]) => {
      formData.append(k, v)
    })
    formData.append("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", presignedPost.url)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        console.log(xhr)
        openXmlDebugTab(xhr.responseText)
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => reject(new Error("Upload failed (network error)"))
    xhr.send(formData)
  })
}
