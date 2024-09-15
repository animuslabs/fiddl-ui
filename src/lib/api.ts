import Axios from "axios"

import { type LiveTranscriptionEvent } from "@deepgram/sdk"
// export const apiUrl = "http://localhost:4444"
// export const apiUrl = "https://api.defidash.app"
export let apiUrl = process.env.API_URL || "localhost:4444"
if (!apiUrl.startsWith("http") && !apiUrl.startsWith("https")) {
  if (apiUrl.startsWith("localhost")) apiUrl = "http://" + apiUrl
  else apiUrl = "https://" + apiUrl
}
let wsUrl = apiUrl.replace("http", "ws")
if (wsUrl.endsWith("/")) wsUrl = wsUrl.slice(0, -1)

console.log("API URL", apiUrl)
export const ax = Axios.create({ baseURL: apiUrl })
import type { CreateImageRequest, CreateImageResponse, ImageSize } from "../../../fiddl-server/src/lib/types/serverTypes"
import type { PointsPackageWithUsd } from "../../../fiddl-server/src/lib/pointsPackages"
import type { PayPalOrderCreated } from "../../../fiddl-server/src/lib/payPal"

import { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types"
import { TranscriptionLineEvent, TranscriptLine, UserFile, VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from "lib/types"
import { jwt } from "lib/jwt"
import { blobToDataURL, downloadFile, throwErr } from "lib/util"
import { User } from "lib/prisma"
// import { LivePrompt, LiveSession, LiveSessionWithRelations } from "lib/prisma"
import { ref, Ref } from "vue"
import { CreateOrderData, PayPalButtonCreateOrder } from "@paypal/paypal-js"
export const authToken: Ref<string | null> = ref(null)
const jwtData = jwt.read()
if (jwtData) authToken.value = jwtData.token

ax.interceptors.request.use(
  (config) => {
    const jwtData = jwt.read()
    if (jwtData) {
      authToken.value = jwtData.token
      config.headers.Authorization = `Bearer ${jwtData.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

type PaymentMethod = "payPal" | "stripe" | "applePay" | "googlePay"

export const api = {
  points: {
    async getPackages(): Promise<PointsPackageWithUsd[]> {
      return (await ax.get<PointsPackageWithUsd[]>("/points/packages")).data
    },
    async initBuyPackage(packageId: number, method: PaymentMethod = "payPal"): Promise<PayPalOrderCreated> {
      return (await ax.post("/points/initBuyPackage", { packageId, method })).data
    },
    async completeBuyPackage(orderId: string, method: PaymentMethod = "payPal"): Promise<any> {
      console.log("completeBuyPackage", orderId)
      return (await ax.post("/points/completeBuyPackage", { orderId, method })).data
    },
  },
  user: {
    loadUser(userId: string) {
      return ax.get<User>("/user/" + userId)
    },
    findUserIdByEmail(email: string) {
      return ax.get<string>("/user/email/" + email)
    },
    findUserIdByPhone(phone: string) {
      return ax.get<string>("/user/phone/" + phone)
    },
  },
  auth: {
    async register(method: string, data: { phone?: string; email?: string }) {
      if (!data.phone && !data.email) throwErr("Must provide phone or email")
      const result = (await ax.post<PublicKeyCredentialCreationOptionsJSON>("/auth/register/start/" + method, data)).data
      console.log(result)
      return result
    },
    async verifyRegistration(method: string, userId: string, data?: Record<string, any>) {
      return (await ax.post<VerifiedRegistrationResponse>("/auth/register/finish/" + method, { userId, data })).data
    },
    async startLogin(method: string, data?: Record<string, any>) {
      const result = (await ax.post("/auth/login/start/" + method, data)).data
      console.log(result)
      return result
    },
    async finishLogin(method: string, data?: Record<string, any>) {
      const result = (await ax.post<{ authResult: VerifiedAuthenticationResponse; token: any; userId: string }>("/auth/login/finish/" + method, data)).data
      console.log(result)
      if (result.authResult.verified) {
        jwt.save({ userId: result.userId, token: result.token })
      }
      return result
    },
    async logout() {
      return (await ax.post("/auth/logout")).data
    },
  },
  create: {
    async image(params: CreateImageRequest): Promise<CreateImageResponse> {
      return (await ax.post("/create/image", params)).data
    },
  },
  image: {
    async load(id: string, size: ImageSize): Promise<string> {
      const blob = await ax.get("/images/" + `${id}-${size}.webp`, { responseType: "blob" })
      return await blobToDataURL(blob.data)
    },
  },

  // transcribeSocket: () => new WsManager(wsUrl + "/transcribe"),
  // echoSocket: () => new WsManager(wsUrl + "/echo")
}
