import { boot } from "quasar/wrappers"
import { useUserAuth } from "src/stores/userAuth"

export default boot(({ app }) => {
  console.log("quasar boot")
  app.config.globalProperties.$userAuth = useUserAuth()
  if (location.hostname === "localhost") {
    localStorage.setItem("umami.disabled", "true")
  } else {
    localStorage.removeItem("umami.disabled")
  }
})
