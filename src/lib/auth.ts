import * as webAuthN from "@simplewebauthn/browser"
import { pkAuthRegisterStart, pkAuthRegisterFinish, pkAuthLoginStart, pkAuthLoginFinish, userFindByEmail, userFindByPhone } from "lib/orval"
import { getClientTracking } from "lib/tracking"
import { normalizePhoneNumber, throwErr } from "lib/util"

export const passKeyAuth = {
  async register(data: { phone?: string; email?: string; referredByUserName?: string }) {
    const response = await pkAuthRegisterStart({
      email: data.email,
      phone: data.phone,
      referredByUserName: data.referredByUserName,
      tracking: getClientTracking(),
    })
    const registration = response.data as any
    console.log("registerResp", registration)
    const attResp = await webAuthN.startRegistration(registration)
    console.log("attResp", attResp)
    // const verification = await api.auth.verifyRegistration("passKey", registration.user.name, attResp)
    const verificationResponse = await pkAuthRegisterFinish({ userId: registration.user.name, data: attResp })
    const verification = verificationResponse.data as any
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
    const resp = loginResponse.data as any
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
    } else throwErr("Must provide email or phone")
  },
}
