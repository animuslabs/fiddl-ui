import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { createPinia, defineStore } from "pinia"
import api, { type PointsTransfer, type UserData, type UserProfile } from "lib/api"
import { User } from "lib/prisma"
import { jwt } from "lib/jwt"

export const useUserAuth = defineStore("userAuth", {
  state() {
    return {
      loggedIn: false,
      userId: null as string | null,
      userData: null as UserData | null,
      userProfile: null as UserProfile | null,
      pointsHistory: [] as PointsTransfer[],
    }
  },
  actions: {
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
      this.userProfile = await api.user.profile.query(userId!)
    },
    async loadPointsHistory(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId
      this.pointsHistory = await api.user.pointsHistory.query({ userId, limit: 100 })
    },
    setUserId(userId: string) {
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
    async registerAndLogin(data: { email?: string; phone?: string }) {
      const result = await pkAuth.register(data)
      await this.pkLogin(result.registration.user.name)
      console.log(result.registration)
    },
    logout() {
      jwt.remove()
      this.loggedIn = false
      this.userId = null
      this.userData = null
    },
  },
})
export type UserAuthStore = ReturnType<typeof useUserAuth>
