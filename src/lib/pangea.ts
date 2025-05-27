// // Define types for the global Tonomy SDK
// import { setSettings, ExternalUser, SdkError, SdkErrors, setFetch } from "@tonomy/tonomy-id-sdk"

// setSettings({
//   ssoWebsiteOrigin: "https://accounts.testnet.pangea.web4.world",
//   blockchainUrl: "https://blockchain-api-testnet.pangea.web4.world",
//   communicationUrl: "wss://communication.testnet.pangea.web4.world",
// })

// // Development settings
// // if (import.meta.env.DEV) {
// //   setSettings({
// //     ssoWebsiteOrigin: "https://accounts.testnet.pangea.web4.world",
// //     blockchainUrl: "https://blockchain-api-testnet.pangea.web4.world",
// //     communicationUrl: "wss://communication.testnet.pangea.web4.world",
// //   })
// // } else {
// //   // Production settings
// //   setSettings({
// //     ssoWebsiteOrigin: "https://accounts.pangea.web4.world",
// //     blockchainUrl: "https://blockchain-api.pangea.web4.world",
// //     communicationUrl: "wss://communication.pangea.web4.world",
// //   })
// // }
// setFetch(window.fetch.bind(window))

// export async function pangeaLogin() {
//   await ExternalUser.loginWithTonomy({ callbackPath: "/pangeaLogin", dataRequest: { username: true } })
// }

// export async function getPangeaUser() {
//   try {
//     const user = await ExternalUser.getUser()
//     return user
//   } catch (e) {
//     if (e instanceof SdkError) {
//       switch (e.code) {
//         case SdkErrors.AccountNotFound:
//           console.log("Pangea User not found")
//           break
//         case SdkErrors.UserNotLoggedIn:
//           console.error("User logged in but key has expired. User needs to login again")
//           break
//         default:
//           console.error("Unexpected error", e)
//           break
//       }
//     }
//   }
// }

// export async function loginOrRegisterPangeaUser(user: ExternalUser) {
//   const vc = await user.signVc("https://example.com/user-authorization/1234", "UserAuth", {
//     accountName: (await user.getAccountName()).toString(),
//   })
// }
