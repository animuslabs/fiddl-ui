import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { createPinia, defineStore } from "pinia"
import api, { type UserData } from "lib/api"
import { User } from "lib/prisma"
import { jwt } from "lib/jwt"

export const useUserAuth = defineStore("userAuth", {
  state() {
    return {
      loggedIn: false,
      userId: null as string | null,
      userData: null as UserData | null,
    }
  },
  actions: {
    async loadUserData(userId?: string) {
      if (!userId && !this.userId) return
      if (!userId && this.userId) userId = this.userId
      if (userId) this.userId = userId
      this.userData = await api.user.get.query(userId!)
    },
    setUserId(userId: string) {
      this.userId = userId
    },
    async login(userId: string, method = "passKey") {
      if (method == "passKey") {
        const userData = await pkAuth.login(userId)
        await this.loadUserData(userData.userId)
        this.setUserId(userData.userId)
        if (userData.authResult.verified) {
          jwt.save({ userId: userData.userId, token: userData.token })
        }
        this.loggedIn = true
      }
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
      await this.login(userId)
    },
    async phoneLogin(phoneNumber: string) {
      const userId = await api.user.findByPhone.query(phoneNumber)
      await this.login(userId)
    },
    async registerAndLogin(data: { email?: string; phone?: string }) {
      const result = await pkAuth.register(data)
      await this.login(result.registration.user.name)
      console.log(result.registration)
    },
    async logout() {
      jwt.remove()
      this.loggedIn = false
      this.userId = null
      this.userData = null
    },
  },
})
