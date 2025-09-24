import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { defineStore } from "pinia"
import { type NotificationConfig, type PointsTransfer, type UserData, type UserProfile } from "lib/api"
import { User } from "lib/prisma"
import { jwt } from "lib/jwt"
import umami from "lib/umami"
import telemetree from "lib/telemetree"
import { metaPixel } from "lib/metaPixel"
import { catchErr, getReferredBy } from "lib/util"
import { clearImageSecretCache } from "lib/imageCdn"
import { clearAvatarVersion, setAvatarVersion } from "lib/avatarVersion"
import { useImageCreations } from "src/stores/imageCreationsStore"
import {
  adminLoginAsUser,
  loginLinkLoginWithLink,
  loginLinkLoginWithCode,
  privyAuthenticate,
  privyLinkCurrentUser,
  promoCreateAccountWithPromo,
  userFindByEmail,
  userFindByPhone,
  userGet,
  userGetNotificationConfig,
  userPointsHistory,
  userProfile,
  upvotesGetWallet,
  tonomyAuthLoginOrRegister,
  type PrivyAuthenticate200,
  type UpvotesGetWallet200,
} from "lib/orval"
// import type { VerifiableCredential } from "@tonomy/tonomy-id-sdk/build/sdk/types/sdk/util"
import { Dialog } from "quasar"
import { useCreateImageStore } from "src/stores/createImageStore"
import { tawk } from "lib/tawk"
import { avatarImg } from "lib/netlifyImg"
import { extractLoginToken } from "lib/loginLink"

export const useUserAuth = defineStore("userAuth", {
  state() {
    return {
      loggedIn: false,
      userId: null as string | null,
      userData: null as UserData | null,
      userProfile: null as UserProfile | null,
      notificationConfig: null as NotificationConfig | null,
      pointsHistory: [] as PointsTransfer[],
      upvotesWallet: null as UpvotesGetWallet200 | null,
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
      try {
        if (this.userId && this.userData?.AvatarConfig?.imageId) {
          setAvatarVersion(this.userId, this.userData.AvatarConfig.imageId)
        }
      } catch {}
      tawk.setAttributes({ points: this.userData.availablePoints, userId: this.userId })
    },
    async loadUserProfile(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId

      try {
        const response = await userProfile({ userId: userId! })
        this.userProfile = response.data

        if (this.userProfile) {
          umami.identify({ userId: this.userId!, userName: this.userProfile.username! })
          try {
            telemetree.identify({
              userId: this.userId!,
              username: this.userProfile.username || undefined,
              email: this.userProfile.email || undefined,
              phone: this.userProfile.phone || undefined,
              telegramId: this.userProfile.telegramId || undefined,
              createdAt: this.userProfile.createdAt,
              // flags
              emailVerified: this.userProfile.emailVerified,
              phoneVerified: this.userProfile.phoneVerified,
              twitter: this.userProfile.twitter || undefined,
              instagram: this.userProfile.instagram || undefined,
              telegramName: this.userProfile.telegramName || undefined,
            })
          } catch {}
          try {
            metaPixel.setAdvancedMatching({
              em: this.userProfile?.email || undefined,
              external_id: this.userId || undefined,
            })
          } catch {}
        }
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
    async loadUpvotesWallet() {
      try {
        const response = await upvotesGetWallet()
        this.upvotesWallet = response.data
      } catch (e) {
        console.error("Failed to load upvotes wallet", e)
      }
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
      await this.loadUpvotesWallet()
      await this.loadUpvotesWallet()
    },
    async linkLogin(loginToken: string) {
      const token = extractLoginToken(loginToken)
      if (!token) throw new Error("Invalid login token")

      const response = await loginLinkLoginWithLink({ token })
      const userAuth = response.data

      await this.applyServerSession(userAuth.userId, userAuth.token)
    },
    async loginWithCode(code: string) {
      const normalizedCode = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase()
      if (!normalizedCode) throw new Error("Invalid code")

      const response = await loginLinkLoginWithCode({ code: normalizedCode })
      const userAuth = response.data

      await this.applyServerSession(userAuth.userId, userAuth.token)
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
        await this.loadUpvotesWallet()
        void this.loadUserProfile().then(() => {
          void tawk.setVisitorInfo(this.userProfile?.username || this.userId || "anonymous", this.userProfile?.email || "noemail", { userId: this.userId, points: this.userData?.availablePoints, avatar: avatarImg(this.userId!) })
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
    async tonomyLogin(jwtString: string) {
      try {
        const { data } = await tonomyAuthLoginOrRegister({ jwtString, referrerUsername: getReferredBy() })
        this.logout()
        this.setUserId(data.userId)
        jwt.save({ userId: data.userId, token: data.token })
        this.loggedIn = true
        await this.loadUserData(data.userId)
        await this.loadUpvotesWallet()
        void this.loadUserProfile().then(() => {
          void tawk.setVisitorInfo(this.userProfile?.username || this.userId || "anonymous", this.userProfile?.email || "noemail", { userId: this.userId, points: this.userData?.availablePoints, avatar: avatarImg(this.userId!) })
        })
      } catch (e: any) {
        this.logout()
        console.error(e)
        Dialog.create({
          title: "Error",
          message: "Tonomy authentication failed: " + e.message,
          ok: {
            label: "OK",
            flat: true,
            color: "primary",
          },
        })
        throw e
      }
    },
    async linkPrivyAccount(privyToken: string) {
      try {
        const { data } = await privyLinkCurrentUser({ accessToken: privyToken })
        const { userId, token } = data
        this.setUserId(userId)
        jwt.save({ userId, token })
        await this.loadUserData(userId)
        await this.loadUpvotesWallet()
        await this.loadUserProfile(userId)
      } catch (e: any) {
        console.error(e)
        Dialog.create({
          title: "Error",
          message: "Failed to link Privy account: " + e.message,
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

      await this.applyServerSession(userId, token)
    },

    async registerWithPromoCode(promoCode: string) {
      const { data } = await promoCreateAccountWithPromo({ id: promoCode, referrerUsername: getReferredBy() })
      const { token, userId } = data
      // this.logout()
      await this.applyServerSession(userId, token)
      try { metaPixel.trackCompleteRegistration({ status: true }) } catch {}
    },
    async attemptAutoLogin() {
      const savedLogin = jwt.read()
      if (!savedLogin) {
        void tawk.init()
        return false
      }
      // If the saved JWT is expired, clear it and notify
      // if (jwt.isExpired()) {
      //   this.logout()
      //   const { Notify } = await import("quasar")
      //   Notify.create({ message: "Your session has expired. Please log in again.", color: "warning", icon: "logout" })
      //   return false
      // }
      // await this.login(savedLogin.userId)
      await this.loadUserData(savedLogin.userId)
      this.setUserId(savedLogin.userId)
      this.loggedIn = true
      await this.loadUpvotesWallet()
      void this.loadUserProfile().then(() => {
        void tawk.setVisitorInfo(this.userProfile?.username || this.userId || "anonymous", this.userProfile?.email || "noemail", { userId: this.userId, points: this.userData?.availablePoints, avatar: avatarImg(this.userId!) })
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
      try {
        metaPixel.trackCompleteRegistration({ status: true })
      } catch {}
      await this.pkLogin(result.registration.user.name)
      console.log(result.registration)
    },
    async applyServerSession(userId: string, token: string) {
      const sameUser = this.loggedIn && this.userId === userId
      if (this.loggedIn && !sameUser) {
        this.logout()
      }

      this.setUserId(userId)
      jwt.save({ userId, token })
      this.loggedIn = true
      await this.loadUserData(userId)
      await this.loadUpvotesWallet()
      void this.loadUserProfile().then(() => {
        void tawk.setVisitorInfo(this.userProfile?.username || this.userId || "anonymous", this.userProfile?.email || "noemail", {
          userId: this.userId,
          points: this.userData?.availablePoints,
          avatar: avatarImg(this.userId!),
        })
      })
    },
    logout() {
      // Clear our JWT and app state
      const uid = this.userId
      jwt.remove()
      this.loggedIn = false
      this.userId = null
      this.userData = null
      this.notificationConfig = null
      this.userProfile = null
      this.upvotesWallet = null
      umami.identify({ userId: "logged-out" })
      try { telemetree.identify({ userId: "logged-out" }) } catch {}
      clearImageSecretCache()
      if (uid) clearAvatarVersion(uid)
      // useCreateImageStore().$reset()
      // useImageCreations().$reset()
    },
  },
})
export type UserAuthStore = ReturnType<typeof useUserAuth>
