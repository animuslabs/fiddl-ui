import { setSettings, ExternalUser } from "@tonomy/tonomy-id-sdk"
setSettings({
  ssoWebsiteOrigin: "https://accounts.testnet.pangea.web4.world",
  blockchainUrl: "https://blockchain-api-testnet.pangea.web4.world",
})

export async function pangeaLogin() {
  await ExternalUser.loginWithTonomy({ callbackPath: "/callback" })
}
