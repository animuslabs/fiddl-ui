import { boot } from "quasar/wrappers"
import { useUserAuth } from "src/stores/userAuth"

export default boot(({ app }) => {
  app.config.globalProperties.$userAuth = useUserAuth()
  document.querySelectorAll<HTMLDivElement>(".ssr-metadata").forEach((el) => el.remove())

  if (location.hostname === "localhost") {
    localStorage.setItem("umami.disabled", "true")
  } else {
    localStorage.removeItem("umami.disabled")
  }
})
