import { boot } from "quasar/wrappers"
import { useUserAuth } from "src/stores/userAuth"
import { setSettings, setFetch } from "@tonomy/tonomy-id-sdk"
import { events } from "lib/eventsManager"
import { metaPixel } from "lib/metaPixel"
import { jwt } from "lib/jwt"
import { captureTikTokAttributionFromPage } from "lib/tiktokAttribution"
import { captureFirstTouchAttributionFromPage } from "lib/tracking"

export default boot(({ app }) => {
  console.log("quasar boot")
  app.config.globalProperties.$userAuth = useUserAuth()

  // Configure Tonomy ID SDK
  if (typeof window !== "undefined") {
    try {
      captureFirstTouchAttributionFromPage()
    } catch {}
    try {
      captureTikTokAttributionFromPage()
    } catch {}
    // Globally hide broken image icon/outline by tagging failed <img> elements
    try {
      // Mark images that fail to load so CSS can hide UA placeholder
      window.addEventListener(
        "error",
        (evt: Event) => {
          const target = evt.target as HTMLElement | null
          if (target && target.tagName === "IMG") {
            target.classList.add("img-load-error")
          }
        },
        true // use capture since 'error' does not bubble on <img>
      )
      // If an image later loads successfully (e.g., src changes), remove the flag
      window.addEventListener(
        "load",
        (evt: Event) => {
          const target = evt.target as HTMLElement | null
          if (target && target.tagName === "IMG") {
            target.classList.remove("img-load-error")
          }
        },
        true
      )
    } catch {}
    try {
      setFetch(window.fetch.bind(window))
    } catch (e) {
      console.warn("Failed to set Tonomy fetch", e)
    }
    if (import.meta.env.DEV) {
      setSettings({
        ssoWebsiteOrigin: "https://accounts.testnet.tonomy.io",
        blockchainUrl: "https://blockchain-api-testnet.tonomy.io",
        communicationUrl: "wss://communication.testnet.tonomy.io",
        currencySymbol: "TONO",
      })
    } else {
      setSettings({
        ssoWebsiteOrigin: "https://accounts.tonomy.io",
        blockchainUrl: "https://blockchain-api.tonomy.io",
        communicationUrl: "wss://communication.tonomy.io",
        currencySymbol: "TONO",
      })
    }
  }

  if (location.hostname === "localhost") {
    localStorage.setItem("umami.disabled", "true")
  } else {
    localStorage.removeItem("umami.disabled")
  }

  // Initialize unified events dispatcher (best-effort)
  try {
    const debug = !!(import.meta as any).env?.DEV
    events.init({ debug })
    // Initialize Meta Pixel with env pixel id and any early advanced matching
    const pixelId = (import.meta as any)?.env?.VITE_META_PIXEL_ID as string | undefined
    if (typeof window !== "undefined" && pixelId) {
      const saved = jwt.read()
      const am: Record<string, string> = {}
      if (saved?.userId) am.external_id = String(saved.userId)
      metaPixel.init(pixelId, { debug, advancedMatching: Object.keys(am).length ? (am as any) : undefined, skipScriptInject: true })
    }
  } catch {}
})
