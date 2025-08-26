import { boot } from "quasar/wrappers"
import { useUserAuth } from "src/stores/userAuth"
import { setSettings, setFetch } from "@tonomy/tonomy-id-sdk"

export default boot(({ app }) => {
  console.log("quasar boot")
  app.config.globalProperties.$userAuth = useUserAuth()

  // Configure Tonomy ID SDK
  if (typeof window !== "undefined") {
    try {
      setFetch(window.fetch.bind(window))
    } catch (e) {
      console.warn("Failed to set Tonomy fetch", e)
    }
    if (import.meta.env.DEV) {
      setSettings({
        ssoWebsiteOrigin: "https://accounts.testnet.tonomy.io",
        blockchainUrl: "https://blockchain-api-testnet.tonomy.io",
      })
    } else {
      setSettings({
        ssoWebsiteOrigin: "https://accounts.tonomy.io",
        blockchainUrl: "https://blockchain-api.tonomy.io",
      })
    }
  }

  if (location.hostname === "localhost") {
    localStorage.setItem("umami.disabled", "true")
  } else {
    localStorage.removeItem("umami.disabled")
  }
})
