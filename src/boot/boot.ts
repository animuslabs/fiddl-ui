import { boot } from "quasar/wrappers"
import api from "src/lib/api"

export default boot(({ app }) => {
  app.config.globalProperties.$api = api
})
