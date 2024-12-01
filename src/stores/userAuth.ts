import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { createPinia, defineStore } from "pinia"
import api, { type NotificationConfig, type PointsTransfer, type UserData, type UserProfile } from "lib/api"
import { User } from "lib/prisma"
import { jwt } from "lib/jwt"
import umami from "lib/umami"
import { catchErr } from "lib/util"
import { clearImageCache } from "lib/hdImageCache"

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
      this.notificationConfig = await api.user.getNotificationConfig.query()
    },
    async loadUserData(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId
      this.userData = await api.user.get.query(userId!)
    },
    async loadUserProfile(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId
      this.userProfile = (await api.user.profile.query(userId!).catch(catchErr)) || null
      if (this.userProfile) umami.identify({ userId: this.userId!, userName: this.userProfile.username! })
    },
    async loadPointsHistory(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId
      this.pointsHistory = await api.user.pointsHistory.query({ userId, limit: 100 })
    },
    setUserId(userId: string) {
      // clearImageCache()
      this.userId = userId
    },
    async pkLogin(userId: string) {
      // this.logout()
      const userData = await pkAuth.login(userId)
      if (userData.authResult.verified) {
        jwt.save({ userId: userData.userId, token: userData.token })
      }
      await this.loadUserData(userData.userId)
      this.setUserId(userData.userId)
      this.loggedIn = true
    },
    async linkLogin(loginLinkId: string) {
      const userAuth = await api.loginLink.loginWithLink.mutate(loginLinkId)
      this.logout()
      this.setUserId(userAuth.userId)
      jwt.save({ userId: userAuth.userId, token: userAuth.token })
      this.loggedIn = true
    },
    async adminLoginAsUser(userId: string) {
      const token = await api.admin.loginAsUser.mutate(userId)
      this.logout()
      this.setUserId(userId)
      jwt.save({ userId, token })
      this.loggedIn = true
    },
    async attemptAutoLogin() {
      const savedLogin = jwt.read()
      if (!savedLogin) return false
      // await this.login(savedLogin.userId)
      await this.loadUserData(savedLogin.userId)
      this.setUserId(savedLogin.userId)
      this.loggedIn = true
    },
    async emailLogin(email: string) {
      const userId = await api.user.findByEmail.query(email)
      await this.pkLogin(userId)
    },
    async phoneLogin(phoneNumber: string) {
      const userId = await api.user.findByPhone.query(phoneNumber)
      await this.pkLogin(userId)
    },
    async registerAndLogin(data: { email?: string; phone?: string; referredBy?: string }) {
      const result = await pkAuth.register(data)
      await this.pkLogin(result.registration.user.name)
      console.log(result.registration)
    },
    logout() {
      jwt.remove()
      this.loggedIn = false
      this.userId = null
      this.userData = null
      this.notificationConfig = null
      this.userProfile = null
      umami.identify({ userId: "logged-out" })
      clearImageCache()
    },
  },
})
export type UserAuthStore = ReturnType<typeof useUserAuth>
