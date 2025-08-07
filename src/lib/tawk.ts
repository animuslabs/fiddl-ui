declare global {
  interface Window {
    Tawk_API: any
  }
}

export const tawk = {
  get client() {
    return window.Tawk_API
  },

  init() {
    if (!document.querySelector('script[src*="tawk"]')) {
      this.loadScript(() => {
        this.start()
        this.showWidget()
      })
    } else {
      this.start()
      this.showWidget()
    }
  },

  loadScript(callback: () => void) {
    const script = document.createElement("script")
    script.src = "https://embed.tawk.to/68943cd8b89c23192f895677/1j21grc1q"
    script.async = true
    script.charset = "UTF-8"
    script.setAttribute("crossorigin", "*")
    script.onload = callback
    document.head.appendChild(script)
  },

  start() {
    this.client.start()
  },

  shutdown() {
    this.client.shutdown()
  },

  showWidget() {
    this.client.showWidget()
  },

  hideWidget() {
    this.client.hideWidget()
  },

  toggleVisibility() {
    this.client.toggleVisibility()
  },

  onStatusChange(callback: (status: string) => void) {
    this.client.onStatusChange = callback
  },

  onLoad(callback: () => void) {
    this.client.onLoad = callback
  },

  onChatStarted(callback: () => void) {
    this.client.onChatStarted = callback
  },

  onChatEnded(callback: () => void) {
    this.client.onChatEnded = callback
  },

  unloadScript() {
    const script = document.querySelector('script[src*="tawk"]')
    if (script) {
      script.remove()
    }
    delete window.Tawk_API

    // Clear Tawk-related cookies
    document.cookie.split(";").forEach((cookie) => {
      const parts = cookie.split("=")
      if (parts[0]) {
        const name = parts[0].trim()
        if (name.startsWith("twk_") || name.includes("Tawk")) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        }
      }
    })

    // Clear Tawk-related local storage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("twk_") || key.includes("Tawk")) {
        localStorage.removeItem(key)
      }
    })
  },

  reloadScript() {
    this.loadScript(() => {})
  },

  // Set arbitrary custom attributes for the current visitor / chat
  // Keys must be alphanumeric or contain '-' and values ≤ 255 chars
  // Example: tawk.setAttributes({ plan: 'pro', store: 'Midvalley' })
  setAttributes(attributes: Record<string, any>, callback?: (err?: unknown) => void) {
    if (this.client && typeof this.client.setAttributes === "function") {
      this.client.setAttributes(attributes, callback ?? (() => {}))
    }
  },

  setVisitorInfo(name: string, email: string, extraAttributes?: Record<string, any>) {
    this.unloadScript()
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_API.visitor = { name, email }
    this.reloadScript()
    if (extraAttributes)
      setTimeout(() => {
        this.setAttributes(extraAttributes)
      }, 2000)
  },
}
