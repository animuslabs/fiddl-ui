import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, escapeHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)

    const pageTitle = "Studio – Visual Editor for AI Creations | Fiddl.art"
    const description = "Arrange, transform, and iterate on AI images in a fast, visual editor. Export results or send outputs back into generation."

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        description,
        imageUrl: "https://app.fiddl.art/OGImage-1.jpg",
        ogType: "website",
      },
      blocks: {
        jsonLd: [buildStudioAppSchema(`${url.origin}${url.pathname}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildStudioIntroHtml(description), buildStudioFeaturesHtml(), buildStudioGettingStartedHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "studio", e)
    return context.next()
  }
}

function buildStudioAppSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Fiddl Studio",
    description: "Visual editor for arranging and refining AI-generated images and assets.",
    url: pageUrl,
    applicationCategory: "Multimedia",
    operatingSystem: "Web Browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Canvas editing",
      "Layers panel",
      "Non-destructive transforms",
      "Prompt-based edits",
      "Export and reuse outputs",
    ],
  }
  return JSON.stringify(schema)
}

function buildStudioIntroHtml(description: string): string {
  return `
  <section id="studio-intro">
    <h1>Fiddl Studio</h1>
    <p class="lead">${escapeHtml(description)}</p>
  </section>
  `
}

function buildStudioFeaturesHtml(): string {
  const bullets = [
    "Drop multiple assets onto a shared canvas",
    "Select, move, scale, and rotate precisely",
    "Queue AI edits on selected layers",
    "Export results or add back into your canvas",
  ]
  return `
  <section id="studio-features">
    <h2>Key Features</h2>
    <ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
  </section>
  `
}

function buildStudioGettingStartedHtml(): string {
  const steps = [
    "Open Studio and import a few images",
    "Arrange items and select one to adjust transforms",
    "Apply an edit (e.g., prompt tweak) and queue renders",
    "Export outputs or bring them back onto the canvas",
  ]
  return `
  <section id="studio-start">
    <h2>Getting Started</h2>
    <ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
  </section>
  `
}

export default safeEdge(handler, "studio")

export const config: Config = {
  path: "/studio",
}

