import { reactive } from "vue"
import { passKeyAuth as pkAuth } from "lib/auth"
import { createPinia, defineStore } from "pinia"
import { api } from "lib/api"
import { UserData } from "lib/types"
import { jwt } from "lib/jwt"


export const useUserAuth = defineStore("userAuth", {
  state() {
    return {
      loggedIn: false,
      userId: null as string|null,
      userData: null as UserData|null

    }
  },
  actions: {
    async loadUserData(userId:string) {
      this.userId = userId
      const data = await api.user.loadUser(this.userId)
      this.userData = data.data
    },
    setUserId(userId:string) {
      this.userId = userId
    },
    async login(userId:string, method = "passKey") {
      if (method == "passKey") {
        const userData = await pkAuth.login(userId)
        await this.loadUserData(userData.userId)
        this.setUserId(userData.userId)
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
    async emailLogin(email:string) {
      const userId = await api.user.findUserIdByEmail(email)
      await this.login(userId.data)
    },
    async phoneLogin(phoneNumber:string) {
      const userId = await api.user.findUserIdByPhone(phoneNumber)
      await this.login(userId.data)
    },
    async registerAndLogin(data:{email?:string, phone?:string,}) {
      const result = await pkAuth.register(data)
      await this.login(result.registration.user.name)
      console.log(result.registration)
    },
    async logout() {
      jwt.remove()
      this.loggedIn = false
      this.userId = null
      this.userData = null
    }
  }
})

export const userAuth = reactive({
  loggedIn: false,
  userId: null as string|null,
  setUserId(userId:string) {
    this.userId = userId
  },
  async login(method = "passKey") {
    if (method == "passKey") {
      const userData = await pkAuth.login(this.userId!)
      // this.userId = userData.
    }
  }
})
