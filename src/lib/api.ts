import Axios from "axios"
import { WsManager } from "lib/WebSocketManager"
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

import {
  PublicKeyCredentialCreationOptionsJSON
} from "@simplewebauthn/types"
import { TranscriptionLineEvent, TranscriptLine, UserData, UserFile, VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from "lib/types"
import { jwt } from "lib/jwt"
import { downloadFile, throwErr } from "lib/util"
import { LivePrompt, LiveSession, LiveSessionWithRelations } from "lib/prisma"
import { ref, Ref } from "vue"
export let authToken:Ref<string | null> = ref(null)
const jwtData = jwt.read()
if (jwtData) authToken.value = jwtData.token

ax.interceptors.request.use((config) => {
  const jwtData = jwt.read()
  if (jwtData) {
    authToken.value = jwtData.token
    config.headers.Authorization = `Bearer ${jwtData.token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})





export const api = {
  async getFileData(id:string) {
    const result = await ax.get("/file/" + id)
    return result.data
  },
  async getPromptResponse(id:string, prompt:string) {
    const result = await ax.post("/prompt/" + id, { prompt }, { params: { prompt } })
    return result.data
  },
  async protected() {
    const result = await ax.get("/protected")
    console.log(result)
    return result
  },
  file: {
    delete(fileId:string) {
      return ax.delete("/file/" + fileId)
    }
  },
  files: {
    async getUserFiles(userId?:string) {
      if (!userId) userId = jwt.read()?.userId
      if (!userId) throwErr("missing user id")
      const data = (await ax.get<UserFile[]>("/files/" + userId)).data
      return data.map(el => {
        el.createdAt = new Date(el.createdAt)
        return el
      })
    }
  },
  user: {
    loadUser(userId:string) {
      return ax.get<UserData>("/user/" + userId)
    },
    findUserIdByEmail(email:string) {
      return ax.get<string>("/user/email/" + email)
    },
    findUserIdByPhone(phone:string) {
      return ax.get<string>("/user/phone/" + phone)
    }
  },
  auth: {
    async register(method:string, data:{phone?:string, email?:string}) {
      if (!data.phone && !data.email) throwErr("Must provide phone or email")
      const result = (await ax.post<PublicKeyCredentialCreationOptionsJSON>("/auth/register/start/" + method, data)).data
      console.log(result)
      return result
    },
    async verifyRegistration(method:string, userId:string, data?:Record<string, any>) {
      return (await ax.post<VerifiedRegistrationResponse>("/auth/register/finish/" + method, { userId, data })).data
    },
    async startLogin(method:string, data?:Record<string, any>) {
      const result = (await ax.post("/auth/login/start/" + method, data)).data
      console.log(result)
      return result
    },
    async finishLogin(method:string, data?:Record<string, any>) {
      const result = (await ax.post<{authResult:VerifiedAuthenticationResponse, token:any, userId:string}>("/auth/login/finish/" + method, data)).data
      console.log(result)
      if (result.authResult.verified) {
        jwt.save({ userId: result.userId, token: result.token })
      }
      return result
    },
    async logout() {
      return (await ax.post("/auth/logout")).data
    }

  },
  liveSessions: {
    async getUserLiveSessions():Promise<LiveSession[]> {
      let data = (await ax.get<LiveSession[]>("/liveSessions")).data

      return data.map(el => {
        el.createdAt = new Date(el.createdAt)
        el.updatedAt = new Date(el.updatedAt)
        return el
      })
    }
  },
  liveSession: {
    async streamAudio(sessionId:string, start:number, end:number) {
      const response = await ax.get(`/liveSession/streamAudio/${sessionId}`, {
        headers: {
          Range: `bytes=${start}-${end}`
        },
        responseType: "stream"
      })
      return response.data.getReader()
    },
    async downloadAudio(sessionId:string) {
      const data = await ax.get(`/liveSession/downloadAudio/${sessionId}`, { responseType: "blob" })
      await downloadFile(data.data, sessionId + ".mp3")
      return data.data
    },
    async get(sessionId:string, params?:{process?:boolean, includeTranscriptLines?:boolean, includeLivePrompts?:boolean}):Promise<LiveSessionWithRelations> {
      const data = (await ax.get<LiveSessionWithRelations>("/liveSession/" + sessionId, { params })).data
      data.createdAt = new Date(data.createdAt)
      data.updatedAt = new Date(data.updatedAt)
      return data
    },
    async create():Promise<string> {
      const result = await ax.post("/liveSession/create")
      return result.data
    },
    async delete(sessionId:string) {
      return ax.post("/liveSession/delete/" + sessionId)
    },
    async setName(sessionId:string, name:string) {
      return ax.post("/liveSession/update/" + sessionId, { name })
    },
    async setSpeakerNames(sessionId:string, speakerNames:Record<string, string>) {
      return ax.post("/liveSession/update/" + sessionId, { speakerNames })
    }
  },
  livePrompts: {
    async delete(liveSessionId:string, livePromptId:string):Promise<LivePrompt> {
      const result = await ax.get("/livePrompt/delete/" + liveSessionId + "/" + livePromptId)
      console.log(result)
      return result.data
    },
    async refresh(liveSessionId:string, livePromptId:string):Promise<LivePrompt> {
      const result = await ax.get("/livePrompt/refresh/" + liveSessionId + "/" + livePromptId)
      console.log(result)
      return result.data
    },
    async getSessionPrompts(sessionId:string) {
      const result = await ax.get("/liveSession/prompts/" + sessionId)
      return result.data
    },
    async addPrompt(liveSessionId:string, prompt:string) {
      const result = await ax.post("/livePrompt/add", { liveSessionId, prompt })
      return result.data
    }
  },
  transcribeSocket: () => new WsManager(wsUrl + "/transcribe"),
  echoSocket: () => new WsManager(wsUrl + "/echo")
}
