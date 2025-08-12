import type { Context } from "@netlify/edge-functions"

type EdgeHandler = (request: Request, context: Context) => Promise<Response> | Response

function toErrorInfo(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const cause = (error as any).cause
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(cause ? { cause: typeof cause === "string" ? cause : (cause as any)?.message || String(cause) } : {}),
    }
  }
  try {
    if (typeof error === "string") return { message: error }
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

export function logEdgeError(request: Request, _context: Context, functionName: string, error: unknown) {
  const url = new URL(request.url)
  const headers = request.headers
  const userAgent = headers.get("user-agent") || ""
  const referer = headers.get("referer") || headers.get("referrer") || ""
  const forwardedFor = headers.get("x-forwarded-for") || ""
  const ip = forwardedFor.split(",")[0]?.trim() || ""

  const errorId = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const payload = {
    level: "error",
    errorId,
    edgeFunction: functionName,
    url: request.url,
    method: request.method,
    pathname: url.pathname,
    search: url.search,
    userAgent,
    referer,
    ip,
    timestamp: new Date().toISOString(),
    ...toErrorInfo(error),
  }

  try {
    console.error(JSON.stringify(payload))
  } catch {
    console.error(`[edge:${functionName}] errorId=${errorId} ${request.method} ${url.pathname}${url.search}`, error)
  }
}

export function safeEdge(handler: EdgeHandler, functionName: string) {
  return async function (request: Request, context: Context): Promise<Response> {
    try {
      return await handler(request, context)
    } catch (error) {
      logEdgeError(request, context, functionName, error)
      try {
        return await context.next()
      } catch (fallbackError) {
        logEdgeError(request, context, `${functionName}:fallback`, fallbackError)
        return new Response("", {
          status: 200,
          headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
        })
      }
    }
  }
}