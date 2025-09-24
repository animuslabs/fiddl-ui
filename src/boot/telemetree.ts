import { boot } from "quasar/wrappers"
import telemetree from "src/lib/telemetree"

export default boot(() => {
  if (typeof window === "undefined") return
  try {
    telemetree.init({
      // Backwards compat: accept appId but map to apiKey internally
      appId: (import.meta as any).env?.VITE_TELEMETREE_API_KEY ?? null,
      projectId: (import.meta as any).env?.VITE_TELEMETREE_PROJECT_ID ?? null,
    })
  } catch {}
})
