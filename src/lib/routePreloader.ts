import type { Router } from "vue-router"

type PrefetchOptions = {
  // Route names to skip (e.g. heavy pages)
  excludeNames?: Array<string | symbol>
  // Max number of concurrent imports
  concurrency?: number
  // Delay before starting (ms)
  delayMs?: number
  // Only run once after the first navigation
  runOnce?: boolean
}

const rIC: typeof window.requestIdleCallback =
  typeof window !== "undefined" && (window as any).requestIdleCallback
    ? (cb: IdleRequestCallback) => (window as any).requestIdleCallback(cb, { timeout: 5000 })
    : (cb: IdleRequestCallback) => window.setTimeout(() => cb(({} as unknown) as IdleDeadline), 0) as any

export function setupRoutePrefetch(router: Router, opts: PrefetchOptions = {}) {
  if (import.meta.env.SSR) return

  const {
    excludeNames = ["magicMirror", "magicMirrorBanana"],
    concurrency = 2,
    delayMs = 300,
    runOnce = true,
  } = opts

  let didRun = false

  const schedule = () => {
    if (runOnce && didRun) return
    didRun = true

    window.setTimeout(() => {
      rIC(() => prefetchAll(router, { excludeNames, concurrency }))
    }, delayMs)
  }

  // Run after the first route is ready
  router.isReady().then(schedule).catch(() => {})

  // Optionally, also run on the first navigation (in case isReady resolved earlier)
  if (!runOnce) {
    router.afterEach(() => schedule())
  }
}

async function prefetchAll(
  router: Router,
  {
    excludeNames,
    concurrency,
  }: { excludeNames: Array<string | symbol>; concurrency: number },
) {
  try {
    const current = router.currentRoute.value
    const currentName = current?.name
    const loaders: Array<() => Promise<unknown>> = []

    // Collect async component loaders from route records
    for (const rec of router.getRoutes()) {
      // Skip current route and excluded names
      if (rec.name && (rec.name === currentName || excludeNames.includes(rec.name))) continue

      // Default (unnamed view) component
      const maybeComp = (rec as any).component ?? (rec as any).components?.default

      // Only consider lazy loaders that are functions returning a Promise when called
      if (typeof maybeComp === "function") {
        loaders.push(() => (maybeComp as () => Promise<unknown>)())
      }
    }

    // Deduplicate by function reference
    const seen = new Set<() => Promise<unknown>>()
    const queue = loaders.filter((fn) => !seen.has(fn) && (seen.add(fn), true))

    if (queue.length === 0) return

    // Fetch with simple concurrency control
    await runWithConcurrency(queue, concurrency)
  } catch (err) {
    if (import.meta.env.DEV) console.warn("route prefetch failed", err)
  }
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number) {
  const pool: Promise<unknown>[] = []
  let i = 0
  const runNext = () => {
    if (i >= tasks.length) return
    const task = tasks[i++]()
    const p = task
      .catch(() => {})
      .finally(() => {
        pool.splice(pool.indexOf(p), 1)
        runNext()
      })
    pool.push(p)
  }

  const starters = Math.max(1, Math.min(limit, tasks.length))
  for (let k = 0; k < starters; k++) runNext()
  await Promise.all(pool)
}

