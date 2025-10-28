import { ensureTelegramSdkLoaded, hasTelegramWebApp, isLikelyTmaSession } from "src/lib/telegramEnv"

type TelemetreeModule = typeof import("lib/telemetree")
type TelemetreeInstance = TelemetreeModule["default"]

let modulePromise: Promise<TelemetreeModule> | null = null
let initPromise: Promise<void> | null = null

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

async function loadModule(): Promise<TelemetreeModule | null> {
  if (!isBrowser()) return null
  if (!(isLikelyTmaSession() || hasTelegramWebApp())) return null
  await ensureTelegramSdkLoaded()
  if (!modulePromise) {
    modulePromise = import("lib/telemetree").catch((err) => {
      modulePromise = null
      throw err
    })
  }
  return modulePromise
}

export async function ensureTelemetreeInitialized(): Promise<TelemetreeInstance | null> {
  const mod = await loadModule()
  if (!mod) return null
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      try {
        mod.default.init({
          appId: (import.meta as any).env?.VITE_TELEMETREE_API_KEY ?? null,
          projectId: (import.meta as any).env?.VITE_TELEMETREE_PROJECT_ID ?? null,
        })
      } catch {
        // swallow to avoid blocking callers; init handles errors internally
      }
    })
      .catch((err) => {
        initPromise = null
        throw err
      })
  }
  await initPromise
  return mod.default
}

export async function getTelemetree(): Promise<TelemetreeInstance | null> {
  const mod = await ensureTelemetreeInitialized()
  return mod
}

