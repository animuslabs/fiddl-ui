import * as webAuthN from "@simplewebauthn/browser"
import api from "lib/api"
import { normalizePhoneNumber, throwErr } from "lib/util"

export const passKeyAuth = {
  async register(data: { phone?: string; email?: string; referredBy?: string }) {
    const registration = await api.pkAuth.registerStart.mutate(data)
    console.log("registerResp", registration)
    const attResp = await webAuthN.startRegistration(registration)
    console.log("attResp", attResp)
    // const verification = await api.auth.verifyRegistration("passKey", registration.user.name, attResp)
    const verification = await api.pkAuth.registerFinish.mutate({ userId: registration.user.name, data: attResp })
    console.log("verificationJSON", verification)
    if (verification?.verified) {
      return {
        registration,
        keyId: attResp.id,
        verification: verification.registrationInfo,
      }
    } else throwErr("registration verification failed")
  },
  async login(userId: string) {
    const resp = await api.pkAuth.loginStart.mutate({ userId })
    console.log(resp)
    const data = await webAuthN.startAuthentication(resp)
    const verificationResp = await api.pkAuth.loginFinish.mutate({ userId, data })
    console.log("verificationJSON", verificationResp)
    return verificationResp
  },
  async findUserId(data: { email?: string; phone?: string }) {
    const email = data.email
    const phone = data.phone
    if (email) return await api.user.findByEmail.query(email)
    else if (phone) return await api.user.findByPhone.query(normalizePhoneNumber(phone))
    else throwErr("Must provide email or phone")
  },
}
