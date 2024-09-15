import * as webAuthN from "@simplewebauthn/browser"
import { api } from "lib/api"
import { normalizePhoneNumber, throwErr } from "lib/util"

export const passKeyAuth = {
  async register(data: { phone?: string; email?: string }) {
    const registration = await api.auth.register("passKey", data)
    console.log("registerResp", registration)
    const attResp = await webAuthN.startRegistration(registration)
    console.log("attResp", attResp)
    const verification = await api.auth.verifyRegistration("passKey", registration.user.name, attResp)
    console.log("verificationJSON", verification)
    if (verification?.verified) {
      return {
        registration,
        keyId: attResp.id,
        verification: verification.registrationInfo,
      }
    } else throwErr("registration verification failed")
  },
  async login(userId: string, saveKey: boolean) {
    const resp = await api.auth.startLogin("passKey", { userId })
    console.log(resp)
    const data = await webAuthN.startAuthentication(resp)
    const verificationResp = await api.auth.finishLogin("passKey", { userId, data })
    console.log("verificationJSON", verificationResp)
    return verificationResp
  },
  async findUserId(data: { email?: string; phone?: string }) {
    const email = data.email
    const phone = data.phone
    if (email) return (await api.user.findUserIdByEmail(email)).data
    else if (phone) return (await api.user.findUserIdByPhone(normalizePhoneNumber(phone))).data
    else throwErr("Must provide email or phone")
  },
}
