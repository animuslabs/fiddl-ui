import * as webAuthN from "@simplewebauthn/browser"
import api from "lib/api"
import { pkAuthRegisterStart, pkAuthRegisterFinish, pkAuthLoginStart, pkAuthLoginFinish, userFindByEmail, userFindByPhone } from "lib/orval"
import { normalizePhoneNumber, throwErr } from "lib/util"

export const passKeyAuth = {
  async register(data: { phone?: string; email?: string; referredBy?: string }) {
    const response = await pkAuthRegisterStart(data)
    const registration = response.data
    console.log("registerResp", registration)
    const attResp = await webAuthN.startRegistration(registration)
    console.log("attResp", attResp)
    // const verification = await api.auth.verifyRegistration("passKey", registration.user.name, attResp)
    const verificationResponse = await pkAuthRegisterFinish({ userId: registration.user.name, data: attResp })
    const verification = verificationResponse.data
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
    const loginResponse = await pkAuthLoginStart({ userId })
    const resp = loginResponse.data
    console.log(resp)
    const data = await webAuthN.startAuthentication(resp)
    const loginFinishResponse = await pkAuthLoginFinish({ userId, data })
    const verificationResp = loginFinishResponse.data
    console.log("verificationJSON", verificationResp)
    return verificationResp
  },
  async findUserId(data: { email?: string; phone?: string }) {
    const email = data.email
    const phone = data.phone
    if (email) {
      const response = await userFindByEmail({ email })
      return response.data
    } else if (phone) {
      const response = await userFindByPhone({ phone: normalizePhoneNumber(phone) })
      return response.data
    }
    else throwErr("Must provide email or phone")
  },
}
