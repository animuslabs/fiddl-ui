import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, escapeHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const pageTitle = "Terms of Service | Fiddl.art"
    const description = "Read the Fiddl.art Terms of Service. Learn about account use, content ownership, acceptable use, and limitations."

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        description,
        imageUrl: "https://app.fiddl.art/fiddlLogo.webp",
        ogType: "website",
        twitterCard: "summary",
      },
      blocks: {
        jsonLd: [buildTosWebPageSchema(`${url.origin}${url.pathname}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildTosSummaryHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "tos", e)
    return context.next()
  }
}

function buildTosWebPageSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service",
    url: pageUrl,
    description: "Terms governing use of Fiddl.art services",
    isPartOf: { "@type": "WebSite", name: "Fiddl.art", url: "https://app.fiddl.art" },
  }
  return JSON.stringify(schema)
}

function buildTosSummaryHtml(): string {
  return `
  <section id="tos">
    <h1>Terms of Service</h1>
    <p class="lead">This page summarizes key terms. For full terms, visit our legal site.</p>
    <h2>Accounts</h2>
    <p>You are responsible for your account activity and keeping credentials secure.</p>
    <h2>Content</h2>
    <p>You retain rights to your uploads and creations. When public, your content may be shown in galleries and feeds.</p>
    <h2>Acceptable Use</h2>
    <p>No illegal content, harassment, or violations of others’ IP. We may remove content that breaks policy.</p>
    <h2>Limits</h2>
    <p>Services are provided as-is with reasonable efforts to maintain availability.</p>
  </section>
  `
}

export default safeEdge(handler, "tos")

export const config: Config = {
  path: "/tos",
}

