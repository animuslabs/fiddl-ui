import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, escapeHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)

    const pageTitle = "Forge – Train Custom AI Models | Fiddl.art"
    const description =
      "Train a personal AI model from your own photos. Generate consistent characters, styles, and branded visuals from a model that’s yours."

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
        jsonLd: [buildForgeAppSchema(`${url.origin}${url.pathname}`), buildForgeHowToSchema(`${url.origin}${url.pathname}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildForgeIntroHtml(description), buildForgeUseCasesHtml(), buildForgeStepsHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "forge", e)
    return context.next()
  }
}

function buildForgeAppSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": pageUrl,
    name: "Fiddl Forge",
    description: "Train custom AI models with your own images and generate brand-consistent content.",
    url: pageUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web Browser",
    featureList: [
      "Personal model training",
      "Style and identity preservation",
      "Image and video generation",
      "Batch generation",
      "High-resolution output",
    ],
    potentialAction: {
      "@type": "CreateAction",
      name: "Train a custom AI model",
      target: { "@type": "EntryPoint", urlTemplate: pageUrl },
    },
  }
  return JSON.stringify(schema)
}

function buildForgeHowToSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to train a custom AI model on Fiddl",
    description: "Create a personal AI model in minutes from a handful of photos.",
    url: pageUrl,
    totalTime: "PT5M",
    step: [
      { "@type": "HowToStep", name: "Collect images", text: "Pick 10–20 clear photos of the subject with varied angles and lighting." },
      { "@type": "HowToStep", name: "Upload to Forge", text: "Open Forge and upload the photos you want the model to learn from." },
      { "@type": "HowToStep", name: "Start training", text: "Name your model and start training. This typically takes a few minutes." },
      { "@type": "HowToStep", name: "Generate", text: "Use your model in Create to generate consistent images and videos." },
    ],
  }
  return JSON.stringify(schema)
}

function buildForgeIntroHtml(description: string): string {
  return `
  <section id="forge-intro">
    <h1>Forge: Train Custom AI Models</h1>
    <p class="lead">${escapeHtml(description)}</p>
  </section>
  `
}

function buildForgeUseCasesHtml(): string {
  const items = [
    { h: "Consistent Characters", p: "Keep the same identity across many images and scenes." },
    { h: "Brand & Style", p: "Generate material that matches your brand’s look and feel." },
    { h: "Product Shots", p: "Create varied angles and environments without new photoshoots." },
  ]
  return `
  <section id="forge-uses">
    <h2>What You Can Do</h2>
    <ul>
      ${items.map((i) => `<li><strong>${escapeHtml(i.h)}:</strong> ${escapeHtml(i.p)}</li>`).join("")}
    </ul>
  </section>
  `
}

function buildForgeStepsHtml(): string {
  const steps = [
    "Upload 10–20 images with varied angles",
    "Start training and wait a few minutes",
    "Open Create and select your new model",
    "Generate images and videos with prompts",
  ]
  return `
  <section id="forge-steps">
    <h2>How It Works</h2>
    <ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
  </section>
  `
}

export default safeEdge(handler, "forge")

export const config: Config = {
  path: "/forge/:mode?",
}

