import type { Context, Config } from "@netlify/edge-functions"

interface CacheContext extends Context {
  cache: {
    get(key: string): Promise<Response | undefined>
    set(key: string, resp: Response, ttlSeconds?: number): Promise<void>
  }
}

export const config: Config = {
  cache: "manual",
  path: "/model/:slug",
}

export default async (req: Request, _ctx: Context) => {
  const context = _ctx as CacheContext
  const cacheKey = `model-page-${slug}`
  const cached = await context.cache.get(cacheKey)
  if (cached) return cached

  const resp = await context.next()
  const html = await resp.text()
  const modified = myInject(html)

  const newResp = new Response(modified, {
    headers: {
      "Cache-Control": "public, s-maxage=3600",
      "Content-Type": "text/html",
    },
  })

  await context.cache.set(cacheKey, newResp.clone(), 3600)
  return newResp
}
