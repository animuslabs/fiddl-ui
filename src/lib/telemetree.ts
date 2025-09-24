import CryptoJS from "crypto-js"
import { JSEncrypt } from "jsencrypt"

declare global {
  interface Window {
    __telemetree?: {
      apiKey?: string
      projectId?: string
      identify?: (traits: Record<string, any>) => void
      track?: (event: string, props?: Record<string, any>) => void
      _queue?: Array<{ t: string; p?: Record<string, any> }>
    }
    Telegram?: any
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function nowTs(): string { return Math.floor(Date.now() / 1000).toString() }
function nowMs(): string { return Date.now().toString() }

type TelemetreeRemoteConfig = {
  host: string
  public_key: string
  auto_capture?: boolean
  auto_capture_tags?: string[]
}

class Telemetree {
  private _apiKey: string | null = null
  private _projectId: string | null = null
  private _debug = false
  private _config: TelemetreeRemoteConfig | null = null
  private _sessionId = nowMs()
  private _appName = "fiddl"
  private _initialized = false

  init(opts?: { appId?: string | null; apiKey?: string | null; projectId?: string | null; debug?: boolean; appName?: string }): void {
    if (!isBrowser()) return
    const apiKey = opts?.apiKey ?? opts?.appId ?? (import.meta as any).env?.VITE_TELEMETREE_API_KEY ?? null
    const projectId = opts?.projectId ?? (import.meta as any).env?.VITE_TELEMETREE_PROJECT_ID ?? null
    this._appName = (opts?.appName || (import.meta as any).env?.VITE_TMA_ANALYTICS_APP || "fiddl").toString()
    this._debug = !!opts?.debug || !!(import.meta as any).env?.DEV
    if (!apiKey || !projectId) {
      if (this._debug) console.info("[Telemetree] disabled (missing API key or project id)")
      return
    }
    this._apiKey = String(apiKey)
    this._projectId = String(projectId)
    const w = window as Window
    w.__telemetree = w.__telemetree || { _queue: [] }
    w.__telemetree.apiKey = this._apiKey
    w.__telemetree.projectId = this._projectId
    if (!w.__telemetree.identify) w.__telemetree.identify = (t) => this._enqueue("identify", t)
    if (!w.__telemetree.track) w.__telemetree.track = (e, p) => this._enqueue(e, p)
    if (this._debug) console.info("[Telemetree] initializing", { projectId: this._projectId })
    // Kick off async config load and then flush queue
    void this._loadConfig().then(() => {
      this._initialized = true
      this._flushQueue()
      if (this._debug) console.info("[Telemetree] ready", { host: this._config?.host })
    }).catch((e) => {
      if (this._debug) console.warn("[Telemetree] config load failed", e)
    })
  }

  enabled(): boolean {
    return !!this._apiKey && !!this._projectId
  }

  identify(traits: Record<string, any>): void {
    if (!isBrowser() || !this.enabled()) return
    this._sendOrQueue("identify", traits)
    if (this._debug) console.debug("[Telemetree] identify", traits)
  }

  track(event: string, props?: Record<string, any>): void {
    if (!isBrowser() || !this.enabled()) return
    this._sendOrQueue(event, props)
    if (this._debug) console.debug("[Telemetree] track", event, props || {})
  }

  private _enqueue(event: string, props?: Record<string, any>) {
    try {
      const w = window as any
      w.__telemetree = w.__telemetree || { _queue: [] }
      w.__telemetree._queue!.push({ t: event, p: props || {} })
    } catch {}
  }

  private _flushQueue() {
    try {
      const w = window as any
      const q: Array<{ t: string; p?: Record<string, any> }> = w.__telemetree?._queue || []
      if (!q.length) return
      w.__telemetree!._queue = []
      for (const item of q) this._send(item.t, item.p || {})
    } catch {}
  }

  private async _loadConfig(): Promise<void> {
    if (!this._apiKey || !this._projectId) return
    const url = `https://config.ton.solutions/v1/client/config?project=${encodeURIComponent(this._projectId)}`
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${this._apiKey}` },
      credentials: "omit",
    })
    if (!res.ok) throw new Error(`Config HTTP ${res.status}`)
    this._config = (await res.json()) as TelemetreeRemoteConfig
  }

  private _sendOrQueue(event: string, props?: Record<string, any>) {
    if (!this._initialized || !this._config?.host || !this._config?.public_key) return this._enqueue(event, props)
    this._send(event, props || {})
  }

  private _send(event: string, props: Record<string, any>) {
    try {
      if (!this._config || !this._apiKey || !this._projectId) return
      const data = this._buildEvent(event, props)
      if (!data) return // not in Telegram Mini App context
      const { key, iv, body } = this._encrypt(JSON.stringify(data), this._config.public_key)
      void fetch(this._config.host, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this._apiKey,
          "x-project-id": this._projectId,
        },
        body: JSON.stringify({ key, iv, body }),
        credentials: "omit",
      }).catch(() => {})
    } catch {}
  }

  private _buildEvent(eventName: string, props: Record<string, any>): any | null {
    try {
      const tg = (window as any)?.Telegram?.WebApp
      const u = tg?.initDataUnsafe?.user
      if (!u?.id) return null // Only send events from TMA sessions
      const startParam = tg?.initDataUnsafe?.start_param || ""
      const device = tg?.platform || "unknown"
      const refType = tg?.initDataUnsafe?.chat_type || "N/A"
      const ref = tg?.initDataUnsafe?.chat_instance || "0"
      return {
        eventType: eventName,
        userDetails: {
          username: u?.username || "",
          firstName: u?.first_name || "",
          lastName: u?.last_name || "",
          isPremium: !!u?.is_premium,
          writeAccess: !!u?.allows_write_to_pm,
        },
        app: this._appName,
        eventDetails: { startParameter: startParam, path: document.location.pathname, params: props },
        telegramID: String(u.id),
        language: u?.language_code || "",
        device,
        referrerType: refType,
        referrer: ref,
        timestamp: nowTs(),
        isAutocapture: false,
        wallet: props?.wallet,
        sessionIdentifier: this._sessionId,
        eventSource: "telemetree_twa",
      }
    } catch {
      return null
    }
  }

  private _encrypt(plain: string, rsaPublicKey: string): { key: string; iv: string; body: string } {
    const aesKey = CryptoJS.lib.WordArray.random(16)
    const aesIv = CryptoJS.lib.WordArray.random(16)
    const encryptedBody = CryptoJS.AES.encrypt(plain, aesKey, { iv: aesIv }).toString()
    const rsa = new JSEncrypt()
    rsa.setPublicKey(rsaPublicKey)
    const encKey = rsa.encrypt(aesKey.toString())
    if (!encKey) throw new Error("RSA key encrypt failed")
    const encIv = rsa.encrypt(aesIv.toString())
    if (!encIv) throw new Error("RSA iv encrypt failed")
    return { key: encKey, iv: encIv, body: encryptedBody }
  }
}

export const telemetree = new Telemetree()
export default telemetree
