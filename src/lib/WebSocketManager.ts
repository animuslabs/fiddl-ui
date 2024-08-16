import { EventEmitter } from "eventemitter3"
import { jwt } from "lib/jwt"
import { LocalStorage } from "quasar"

export class WsManager {
  apiUrl:string
  retryInterval:number
  maxRetries:number
  retryCount:number
  socket:WebSocket | null
  isManuallyClosed:boolean
  // results:T[] = []
  events:EventEmitter = new EventEmitter()

  constructor(apiUrl:string, retryInterval = 1000, maxRetries = 15) {
    this.apiUrl = apiUrl
    this.retryInterval = retryInterval
    this.maxRetries = maxRetries
    this.retryCount = 0
    this.socket = null
    this.isManuallyClosed = false
    // this.results = LocalStorage.getItem<T[]>("results")?.map((el:any) => el.data || el) || []
  }

  start(extraUrl = "") {
    return new Promise<void>((res, rej) => {
      if (this.socket?.readyState === WebSocket.OPEN) this.socket.close()
      this.events.removeAllListeners()
      console.log("wsManager start")
      const token = jwt.read()?.token
      let url = token ? `${this.apiUrl}?token=${encodeURIComponent(token)}` : this.apiUrl
      url += extraUrl
      this.socket = new WebSocket(url.replace("http", "ws"))

      this.socket.onopen = () => {
        console.log("WebSocket connection established")
        this.retryCount = 0 // Reset retry count on successful connection
        res()
      }

      this.socket.onmessage = (event) => {
        console.log("socket message received", event.data)
        try {
          const data = JSON.parse(event.data)
          this.events.emit("data", data)
        } catch (e) {
          console.error("Error parsing JSON:", e)
        }
      }


      // this.socket.onclose = (event) => {
      //   console.log("socket closing", event)
      //   if (!this.isManuallyClosed && this.retryCount < this.maxRetries) {
      //     setTimeout(() => {
      //       this.retryCount++
      //       console.log(`Attempting to reconnect... (Attempt ${this.retryCount})`)
      //       void this.start()
      //     }, this.retryInterval * this.retryCount) // Increase delay with each attempt
      //   }
      // }

      this.socket.onerror = (error) => {
        console.error("WebSocket encountered an error:", error)
        if (this.socket) this.socket.close()
        rej(error)
      }
    })
  }

  send(data:any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log("Sending data:", data)
      this.socket.send(data)
    } else {
      if (this.socket) console.log(this.socket.readyState)
      console.log("Socket is not open. Cannot send data.")
    }
  }

  end() {
    this.isManuallyClosed = true // Set the flag before closing
    if (this.socket) {
      this.socket.close()
    }
  }
}
