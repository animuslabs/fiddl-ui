import { boot } from "quasar/wrappers"
import { resolveMaterialSymbolOutlined } from "src/lib/materialSymbolsOutlined"

export default boot(({ app }) => {
  const $q = app.config.globalProperties.$q
  if (!$q) return

  const previousMap = typeof $q.iconMapFn === "function" ? $q.iconMapFn : null

  $q.iconMapFn = (name: string) => {
    const mapped = resolveMaterialSymbolOutlined(name)
    if (mapped) {
      return { icon: mapped }
    }
    return previousMap ? previousMap(name) : undefined
  }
})
