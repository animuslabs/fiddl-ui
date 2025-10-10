declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string
    VUE_ROUTER_MODE: "hash" | "history" | "abstract" | undefined
    VUE_ROUTER_BASE: string | undefined
    VITE_API_URL: string
    VITE_PRIVY_APP_ID: string
    VITE_TELEMETREE_API_KEY?: string
    VITE_TELEMETREE_PROJECT_ID?: string
    VITE_META_PIXEL_ID?: string
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_TELEMETREE_API_KEY?: string
  readonly VITE_TELEMETREE_PROJECT_ID?: string
  readonly VITE_META_PIXEL_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
