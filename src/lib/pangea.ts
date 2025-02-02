// Define types for the global Tonomy SDK
import { ExternalUser } from "@tonomy/tonomy-id-sdk"

export async function pangeaLogin() {
  await ExternalUser.loginWithTonomy({ callbackPath: "/callback" })
}
