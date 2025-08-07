import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { defineStore } from "pinia"
import { type NotificationConfig, type PointsTransfer, type UserData, type UserProfile } from "lib/api"
import { User } from "lib/prisma"
import { jwt } from "lib/jwt"
import umami from "lib/umami"
import { catchErr, getReferredBy } from "lib/util"
import { clearImageCache } from "lib/hdImageCache"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { adminLoginAsUser, loginLinkLoginWithLink, privyAuthenticate, userFindByEmail, userFindByPhone, userGet, userGetNotificationConfig, userPointsHistory, userProfile, type PrivyAuthenticate200 } from "lib/orval"
// import type { VerifiableCredential } from "@tonomy/tonomy-id-sdk/build/sdk/types/sdk/util"
import { getAccessToken } from "@privy-io/react-auth"
import { Dialog } from "quasar"
import { privy } from "lib/privy"
import { useCreateImageStore } from "src/stores/createImageStore"
import { tawk } from "lib/tawk"

export const useUserAuth = defineStore("userAuth", {
  state() {
    return {
      loggedIn: false,
      userId: null as string | null,
      userData: null as UserData | null,
      userProfile: null as UserProfile | null,
      notificationConfig: null as NotificationConfig | null,
      pointsHistory: [] as PointsTransfer[],
    }
  },
  actions: {
    async loadNotificationConfig(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId

      const response = await userGetNotificationConfig()
      this.notificationConfig = response.data
    },
    async loadUserData(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId
      if (!this.userId) return
      if (!userId) userId = this.userId
      const response = await userGet({ userId })
      this.userData = response.data
    },
    async loadUserProfile(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId

      try {
        const response = await userProfile({ userId: userId! })
        this.userProfile = response.data

        if (this.userProfile) umami.identify({ userId: this.userId!, userName: this.userProfile.username! })
      } catch (error) {
        this.userProfile = null
      }
    },
    async loadPointsHistory(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId

      const response = await userPointsHistory({ userId, limit: 100 })
      this.pointsHistory = response.data
    },
    setUserId(userId: string) {
      // clearImageCache()
      this.userId = userId
    },
    async pkLogin(userId: string) {
      // this.logout()
      const userData = (await pkAuth.login(userId)) as any
      if (userData.authResult.verified) {
        jwt.save({ userId: userData.userId, token: userData.token })
      }
      await this.loadUserData(userData.userId)
      this.setUserId(userData.userId)
      this.loggedIn = true
    },
    async linkLogin(loginLinkId: string) {
      const response = await loginLinkLoginWithLink({ linkId: loginLinkId })
      const userAuth = response.data

      this.logout()
      this.setUserId(userAuth.userId)
      jwt.save({ userId: userAuth.userId, token: userAuth.token })
      this.loggedIn = true
    },
    // async pangeaLogin(vcString: VerifiableCredential<{ accountName: string }>) {
    //   const userAuth = await api.pangea.loginOrRegister.mutate({ vcString, referredBy: getReferredBy() })
    //   this.logout()
    //   this.setUserId(userAuth.userId)
    //   jwt.save({ userId: userAuth.userId, token: userAuth.token })
    //   this.loggedIn = true
    // },
    async privyLogin(privyToken: string) {
      try {
        // Use the Privy token to authenticate with our server
        // Our server will verify this token with Privy and return our own JWT
        const { data: authResult } = await privyAuthenticate({
          accessToken: privyToken,
          referrerUsername: getReferredBy(),
        })

        // Clear previous login state
        this.logout()

        // Save our server's JWT token (not the Privy token)
        this.setUserId(authResult.userId)
        jwt.save({ userId: authResult.userId, token: authResult.token })
        this.loggedIn = true
        await this.loadUserData(authResult.userId)
        void this.loadUserProfile().then(() => {
          tawk.setVisitorInfo(this.userProfile?.username || this.userId || "anonymous", this.userProfile?.email || "noemail")
        })
      } catch (e: any) {
        this.logout()
        console.log(e)
        Dialog.create({
          title: "Error",
          message: "Authentication failed: " + e.message,
          ok: {
            label: "OK",
            flat: true,
            color: "primary",
          },
        })
        throw e
      }
    },
    async adminLoginAsUser(userId: string) {
      const response = await adminLoginAsUser({ id: userId })
      const token = response.data

      this.logout()
      this.setUserId(userId)
      jwt.save({ userId, token })
      this.loggedIn = true
    },
    async attemptAutoLogin() {
      const savedLogin = jwt.read()
      if (!savedLogin) {
        tawk.init()
        return false
      }
      // await this.login(savedLogin.userId)
      await this.loadUserData(savedLogin.userId)
      this.setUserId(savedLogin.userId)
      this.loggedIn = true
      void this.loadUserProfile().then(() => {
        tawk.setVisitorInfo(this.userProfile?.username || this.userId || "anonymous", this.userProfile?.email || "noemail")
      })
    },
    async emailLogin(email: string) {
      const { data: userId } = await userFindByEmail({ email })
      await this.pkLogin(userId)
    },
    async phoneLogin(phoneNumber: string) {
      const { data: userId } = await userFindByPhone({ phone: phoneNumber })
      await this.pkLogin(userId)
    },
    async registerAndLogin(data: { email?: string; phone?: string; referredBy?: string }) {
      const result = await pkAuth.register(data)
      await this.pkLogin(result.registration.user.name)
      console.log(result.registration)
    },
    logout() {
      privy.auth.logout().catch((err) => console.error("Failed to logout from Privy:", err))
      // Clear our JWT and app state
      jwt.remove()
      this.loggedIn = false
      this.userId = null
      this.userData = null
      this.notificationConfig = null
      this.userProfile = null
      umami.identify({ userId: "logged-out" })
      void clearImageCache()
      useCreateImageStore().$reset()
      useImageCreations().$reset()
    },
  },
})
export type UserAuthStore = ReturnType<typeof useUserAuth>
