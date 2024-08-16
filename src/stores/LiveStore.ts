import { api } from "lib/api"
import { ConversationRecorder } from "lib/ConversationRecorder"
import { LivePrompt, LiveSession } from "lib/prisma"
import { prepareTranscript } from "lib/transcriptionUtil"
import { TranscriptLine } from "lib/types"
import { throwErr } from "lib/util"
import { WsManager } from "lib/WebSocketManager"
import { defineStore } from "pinia"
import { Dialog, Notify, Loading } from "quasar"
import router from "src/router"
import { nextTick, ref, shallowReactive } from "vue"
class LiveSessionStoreState {
  sessionData:LiveSession | null = null
  prompts:LivePrompt[] = []
  loadedLines:TranscriptLine[] = []
  loadingSpeakerNames = false
  loading = false
  capturing = false
  liveSessions:LiveSession[] = []
  convRecorder:ConversationRecorder = new ConversationRecorder()
  transcribeS:WsManager = api.transcribeSocket()
  results:TranscriptLine[] = []
  showAllCards:boolean|null = null
}

export const useLiveStore = defineStore("liveStore", {
  state: () => ({ ...new LiveSessionStoreState() }),
  getters: {
    sessionId():string | undefined {
      return this.sessionData?.id
    },
    transcript():TranscriptLine[] {
      return prepareTranscript([...this.loadedLines, ...this.results])
    },
    speakerNames():Record<string, string> | undefined {
      return this.sessionData?.speakerNames as Record<string, string> || undefined
    }
  },

  actions: {
    async setShowAllCards(show:boolean) {
      this.showAllCards = null
      void nextTick(() => { this.showAllCards = show })
    },
    async setSpeakerNames() {
      if (!this.sessionData) return
      try {
        // const myName = ref("")
        const calleName = ref("")
        // Loading.show()
        const prompt = Dialog.create({
          message: "Set the name of the person being called",
          prompt: { model: calleName.value, outlined: true }
        })
        prompt.onOk(async(data:string) => {
          if (!this.sessionId || !this.sessionData) return
          const speakerData = { 1: data }
          this.loadingSpeakerNames = true
          await api.liveSession.setSpeakerNames(this.sessionId, speakerData)
          this.sessionData.speakerNames = speakerData
          this.loadingSpeakerNames = false
        })
        // await api.liveSession.setSpeakerNames(this.sessionData.id, speakerNames)
        // Notify.create({ message: "Speaker names updated", color: "positive" })
      } catch (err:any) {
        this.loadingSpeakerNames = false
        throwErr(err)
      }
      this.loadingSpeakerNames = false
    },
    async showDeleteSessionModal(sessionId?:string) {
      return new Promise<void>((resolve, reject) => {
        try {
          if (!sessionId) sessionId = this.sessionId
          if (!this.sessionId) return
          Dialog.create({
            title: "Delete Live Session",
            message: "Are you sure you want to delete this live session?",
            ok: {
              label: "Delete",
              color: "negative"
            },
            cancel: "Cancel"
          })
            .onOk(async() => {
              if (!this.sessionId) return
              await api.liveSession.delete(this.sessionId)
              Notify.create({
                message: "Session deleted",
                color: "positive"
              })
              resolve()
            })
        } catch (e) {
          reject()
          console.error(e)
          Notify.create({
            message: "Failed to delete session",
            color: "negative"
          })
        }
      })
    },
    test(sessionId:string) {
      console.log("test")
      void this.transcribeS.start(`&sessionId=${sessionId}`)
    },
    async stopTranscribe() {
      console.log("stopping transcribe")
      this.convRecorder.stopCapture()
      this.transcribeS.end()
      this.convRecorder.events.removeAllListeners()
    },
    async startTranscribe(sessionId:string) {
      console.log("Initializing startTranscribe")
      this.convRecorder.events.on("data", (data:Blob) => {
        console.log("Data event received in LiveStore", data)
        this.transcribeS.send(data)
      })
      await this.convRecorder.init()
      await this.transcribeS.start(`&sessionId=${sessionId}`)
      this.transcribeS.events.on("data", (data:any) => {
        console.log("transcribe data", data)
        this.results.push(data)
      })
      await this.convRecorder.startCapture()
      console.log("transcribe started")
    },
    async loadUserLiveSessions() {
      this.loading = true
      console.log("loading live sessions")
      const sessions = await api.liveSessions.getUserLiveSessions().catch(console.error)
      // console.log(sessions.map(el => el.name))
      if (sessions) this.liveSessions = sessions
      this.loading = false
    },
    async reloadSessionData() {
      if (!this.sessionId) return
      await this.loadSessionData(this.sessionId, false)
    },
    async triggerNewNameModal(sessionId?:string) {
      if (!sessionId) sessionId = this.sessionId || ""
      Loading.show()
      this.sessionData = await api.liveSession.get(sessionId)
      // await this.loadSessionData(sessionId, false).catch(console.error)
      Loading.hide()
      return new Promise<void>((resolve, reject) => {
        Dialog.create({
          title: "Update Session Name",
          prompt: {
            model: this.sessionData?.name || ""
          },
          persistent: true,
          ok: {
            label: "Update",
            color: "positive"
          },
          cancel: "Cancel"
        })
          .onOk(async(data:string) => {
            if (!this.sessionId) return
            await api.liveSession.setName(this.sessionId, data)
            Notify.create({
              message: "Session name updated",
              color: "positive"
            })
            void this.reloadSessionData()
            resolve()
          })
      })
    },
    async loadSessionData(sessionId:string, includeTranscriptLines = false) {
      try {
        console.log("loading session data")
        this.loading = true
        const sessionData = await api.liveSession.get(sessionId, { includeTranscriptLines })
        if (includeTranscriptLines) {
          console.log("clear results")
          this.results = []
          this.loadedLines = [...sessionData.TranscriptLine]
          sessionData.TranscriptLine = []
        }
        this.sessionData = sessionData
        await this.loadPrompts()
        console.log("sessionData", sessionData)
        console.log("sessionPrompts", this.prompts)
        this.loading = false
      } catch (err:any) {
        this.sessionData = null
        this.loading = false
        throwErr(err)
      }
    },
    async loadSpeakerNames() {
      if (!this.sessionId) return
      this.loadingSpeakerNames = true
      const result = await api.liveSession.get(this.sessionId, { process: true, includeLivePrompts: false, includeTranscriptLines: false }).catch(console.error)
      this.loadingSpeakerNames = false
      if (!result) return
      this.sessionData = result
      Notify.create({ message: "Speaker names refreshed", color: "positive" })
    },
    async loadPrompts() {
      if (!this.sessionId) return
      const prompts = await api.livePrompts.getSessionPrompts(this.sessionId)
      this.prompts = prompts
    },
    async addPrompt() {
      return new Promise<void>((resolve, reject) => {
        let addPromptText = ref("")
        const prompt = Dialog.create({
          message: "Ask a question about this conversation, the response can be updated as the conversation progresses.",
          prompt: { model: addPromptText.value, outlined: true, type: "textarea" }
        })
        prompt.onOk(async(newPromptText:string) => {
          if (!this.sessionId) return
          this.loading = true
          this.prompts.unshift({
            createdAt: new Date(),
            id: "",
            liveSessionId: "",
            updatedAt: new Date(),
            processing: true,
            promptResponse: "",
            promptText: newPromptText
          })
          resolve()
          const result = await api.livePrompts.addPrompt(this.sessionId, newPromptText).catch(console.error)
          await this.loadPrompts()
          this.loading = false
          if (!result) Notify.create({ message: "Failed to add prompt", color: "negative" })
        })

        prompt.onCancel(() => {
          console.log("prompt cancelled")
          // reject()
        })
      })
    }
  }
})
