import { boot } from "quasar/wrappers"
import api from "src/lib/api"
import { useUserAuth } from "src/stores/userAuth"

export default boot(({ app }) => {
  // app.config.globalProperties.$api = api
  app.config.globalProperties.$userAuth = useUserAuth()
})
