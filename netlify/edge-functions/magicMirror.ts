import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, escapeHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const pageTitle = "Magic Mirror | Fiddl.art"
    const description = "Transform your selfie into different characters in minutes. Train a quick personal model and generate multiple looks."
    const pageUrl = `${url.origin}${url.pathname}`

    const jsonLd = buildMagicMirrorSchema(pageUrl)

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
        jsonLd: [jsonLd],
        htmlBlocks: [buildStaticTopNavHtml(), buildMagicMirrorIntroHtml(description)],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "magicMirror", e)
    return context.next()
  }
}

function buildMagicMirrorSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": pageUrl,
    name: "Magic Mirror",
    description: "Transform your selfie into different characters in minutes using a quick personal AI model.",
    url: pageUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web Browser",
    featureList: ["Selfie capture", "Quick model training", "Pick 3 looks", "AI image generation", "Optional video animation"],
    potentialAction: {
      "@type": "CreateAction",
      name: "Create Magic Mirror Looks",
      target: {
        "@type": "EntryPoint",
        urlTemplate: pageUrl,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
    },
  }
  return JSON.stringify(schema)
}

function buildMagicMirrorIntroHtml(description: string): string {
  return `
    <section id="magic-mirror">
      <header class="mm-header">
        <h1>Magic Mirror</h1>
        <p class="mm-description">${escapeHtml(description)}</p>
      </header>
      <ol class="mm-steps">
        <li>Capture a few selfies</li>
        <li>We train a quick personal model (takes a few minutes)</li>
        <li>Choose 3 looks to generate</li>
        <li>Download, share, or animate to short video</li>
      </ol>
    </section>
  `
}

export default safeEdge(handler, "magicMirror")

export const config: Config = {
  path: "/magicMirror",
}