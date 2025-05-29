import { boot } from "quasar/wrappers"
import { useUserAuth } from "src/stores/userAuth"

export default boot(({ app }) => {
  app.config.globalProperties.$userAuth = useUserAuth()
})
