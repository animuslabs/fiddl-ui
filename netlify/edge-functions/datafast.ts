import type { Context } from "@netlify/edge-functions"
import { safeEdge } from "./lib/safe.ts"

const ONE_YEAR = 60 * 60 * 24 * 365

const handler = async (request: Request, context: Context) => {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Proxy the DataFast script (regular and hash variants)
  if (pathname === "/js/script.js" || pathname === "/js/script.hash.js") {
    const upstream = `https://datafa.st${pathname}`

    const upstreamRes = await fetch(upstream, {
      // Pass through minimal headers that can help with CDN variants
      headers: {
        "user-agent": request.headers.get("user-agent") || "",
        "accept-encoding": request.headers.get("accept-encoding") || "",
      },
    })

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: new Headers({
        "Content-Type": "application/javascript",
        "Cache-Control": `public, max-age=${ONE_YEAR}, immutable`,
      }),
    })
  }

  // CORS preflight for events endpoint
  if (pathname === "/api/events" && request.method === "OPTIONS") {
    const origin = request.headers.get("origin") || "*"
    return new Response(null, {
      status: 204,
      headers: new Headers({
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") || "content-type",
        "Access-Control-Max-Age": "86400",
      }),
    })
  }

  // Proxy the DataFast events endpoint
  if (pathname === "/api/events" && request.method === "POST") {
    // Derive Origin header for CORS expectations on DataFast side
    const origin = request.headers.get("origin") || url.origin

    // Forward raw body (avoid JSON re-stringify)
    const body = await request.arrayBuffer()

    const headers = new Headers()
    headers.set("Content-Type", request.headers.get("content-type") || "application/json")
    headers.set("User-Agent", request.headers.get("user-agent") || "")
    headers.set("Origin", origin)

    const xff = request.headers.get("x-forwarded-for")
    if (xff) headers.set("X-Forwarded-For", xff)

    const upstreamRes = await fetch("https://datafa.st/api/events", {
      method: "POST",
      headers,
      body,
    })

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: new Headers({
        "Content-Type": upstreamRes.headers.get("Content-Type") || "application/json",
        // Allow cross-origin posting from sibling domains (e.g., fiddl.art -> app.fiddl.art)
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
      }),
    })
  }

  return context.next()
}

export default safeEdge(handler, "datafast")
