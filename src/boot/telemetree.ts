import { boot } from "quasar/wrappers"
import { ensureTelemetreeInitialized } from "src/lib/telemetreeBridge"
import { isLikelyTmaSession } from "src/lib/telegramEnv"

export default boot(() => {
  if (typeof window === "undefined") return
  try {
    if (!isLikelyTmaSession()) return
    void ensureTelemetreeInitialized().catch(() => {})
  } catch {}
})
