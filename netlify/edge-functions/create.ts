import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, escapeHtml } from "./lib/util.ts"
import { imageModels, videoModels, modelTags, aspectRatios } from "../../src/lib/imageModels.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)

    const pageTitle = "Create AI Art | Fiddl.art"
    const description = "Create stunning AI-generated images and videos with advanced AI models. Choose from multiple models, aspect ratios, and customization options. Free and paid plans available."

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
        jsonLd: [buildCreatePageSchema(`${url.origin}${url.pathname}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildCreatePageHtml(), buildModelsListHtml(), buildFeaturesListHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "create", e)
    return context.next()
  }
}

function buildCreatePageSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": pageUrl,
    name: "Fiddl.art AI Art Creator",
    description: "Advanced AI art generation platform with multiple models and customization options",
    url: pageUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web Browser",
    offers: [
      {
        "@type": "Offer",
        name: "Free Plan",
        description: "Basic AI art generation with limited credits",
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Premium Plans",
        description: "Unlimited AI art generation with premium models",
        priceRange: "$5-50",
        priceCurrency: "USD",
      },
    ],
    featureList: ["AI Image Generation", "AI Video Generation", "Multiple AI Models", "Custom Aspect Ratios", "Prompt Engineering", "Custom Model Training", "Batch Generation", "High Resolution Output"],
    softwareRequirements: "Modern Web Browser",
    mainEntity: {
      "@type": "CreativeWork",
      name: "AI Art Generation Tool",
      description: "Create images and videos using artificial intelligence",
      creator: {
        "@type": "Organization",
        name: "Fiddl.art",
        url: "https://app.fiddl.art",
      },
    },
    potentialAction: {
      "@type": "CreateAction",
      name: "Create AI Art",
      description: "Generate AI images and videos",
      target: {
        "@type": "EntryPoint",
        urlTemplate: pageUrl,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
    },
  }

  return JSON.stringify(schema)
}

function buildCreatePageHtml(): string {
  return `
    <div id="create-page" itemscope itemtype="https://schema.org/WebApplication">
      <header class="create-header">
        <h1 itemprop="name">Create AI Art</h1>
        <p class="create-description" itemprop="description">
          Generate stunning AI images and videos using advanced machine learning models.
          Customize every aspect of your creation with professional-grade tools and settings.
        </p>
      </header>

      <div class="create-capabilities">
        <h2>Creation Capabilities</h2>
        <div class="capabilities-grid">
          <div class="capability-item">
            <h3>AI Image Generation</h3>
            <p>Create high-quality images from text prompts using state-of-the-art AI models</p>
            <ul>
              <li>Multiple resolution options</li>
              <li>Batch generation (1-100 images)</li>
              <li>Custom aspect ratios</li>
              <li>Negative prompts for fine control</li>
            </ul>
          </div>

          <div class="capability-item">
            <h3>AI Video Generation</h3>
            <p>Transform ideas into dynamic video content with AI-powered generation</p>
            <ul>
              <li>Text-to-video conversion</li>
              <li>Image-to-video animation</li>
              <li>Multiple duration options</li>
              <li>High-definition output</li>
            </ul>
          </div>

          <div class="capability-item">
            <h3>Custom Model Training</h3>
            <p>Train personalized AI models with your own images for unique results</p>
            <ul>
              <li>Face cloning models</li>
              <li>Style training</li>
              <li>Object-specific models</li>
              <li>LoRA and full fine-tuning</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildModelsListHtml(): string {
  const imageModelsList = imageModels
    .map(
      (model) => `
    <li class="model-item">
      <strong>${escapeHtml(model)}</strong>
      ${getModelDescription(model)}
    </li>
  `,
    )
    .join("")

  const videoModelsList = videoModels
    .map(
      (model) => `
    <li class="model-item">
      <strong>${escapeHtml(model)}</strong>
      ${getVideoModelDescription(model)}
    </li>
  `,
    )
    .join("")

  const tagsList = modelTags
    .map(
      (tag) => `
    <span class="model-tag">${escapeHtml(tag)}</span>
  `,
    )
    .join("")

  const aspectRatiosList = aspectRatios
    .map(
      (ratio) => `
    <li class="aspect-ratio-item">
      <code>${escapeHtml(ratio)}</code>
      <span class="ratio-description">${getAspectRatioDescription(ratio)}</span>
    </li>
  `,
    )
    .join("")

  return `
    <div id="available-models">
      <h2>Available AI Models</h2>

      <div class="models-section">
        <h3>Image Generation Models</h3>
        <ul class="models-list">
          ${imageModelsList}
        </ul>
      </div>

      <div class="models-section">
        <h3>Video Generation Models</h3>
        <ul class="models-list">
          ${videoModelsList}
        </ul>
      </div>

      <div class="models-section">
        <h3>Model Categories</h3>
        <div class="model-tags">
          ${tagsList}
        </div>
      </div>

      <div class="models-section">
        <h3>Supported Aspect Ratios</h3>
        <ul class="aspect-ratios-list">
          ${aspectRatiosList}
        </ul>
      </div>
    </div>
  `
}

function buildFeaturesListHtml(): string {
  return `
    <div id="creation-features">
      <h2>Creation Features & Options</h2>

      <div class="features-grid">
        <div class="feature-group">
          <h3>Prompt Engineering</h3>
          <ul>
            <li>Positive prompt input (unlimited length)</li>
            <li>Negative prompt for excluding elements</li>
            <li>Prompt improvement suggestions</li>
            <li>Random prompt generation</li>
            <li>Style and mood keywords</li>
          </ul>
        </div>

        <div class="feature-group">
          <h3>Generation Settings</h3>
          <ul>
            <li>Quantity control (1-100 images, 1-5 videos)</li>
            <li>Seed control for reproducibility</li>
            <li>Aspect ratio selection</li>
            <li>Resolution options</li>
            <li>Public/private sharing settings</li>
          </ul>
        </div>

        <div class="feature-group">
          <h3>Advanced Options</h3>
          <ul>
            <li>Custom model selection</li>
            <li>Model fine-tuning parameters</li>
            <li>Starting image for video generation</li>
            <li>Duration control for videos</li>
            <li>Batch processing capabilities</li>
          </ul>
        </div>

        <div class="feature-group">
          <h3>Output & Sharing</h3>
          <ul>
            <li>High-resolution downloads</li>
            <li>Multiple format support</li>
            <li>Social media optimization</li>
            <li>Portfolio integration</li>
            <li>License management</li>
          </ul>
        </div>
      </div>

      <div class="getting-started">
        <h3>Getting Started</h3>
        <p>
          To begin creating AI art, simply sign up for a free account and start with our intuitive prompt interface.
          Experiment with different models and settings to discover your unique creative style.
        </p>
        <div class="cta-links">
          <a href="/login" class="cta-button">Sign Up Free</a>
          <a href="/models" class="cta-button">Explore Models</a>
          <a href="/browse" class="cta-button">Browse Gallery</a>
        </div>
      </div>
    </div>
  `
}

function getModelDescription(model: string): string {
  const descriptions = {
    ultra: "- Premium photorealistic image generation",
    "sd3-lg": "- High-quality Stable Diffusion model",
    core: "- Balanced quality and speed",
    "dall-e-3": "- OpenAI's advanced image model",
    "flux-pro-ultra": "- Professional-grade flux model",
    "flux-dev": "- Developer-focused flux model",
    "flux-pro": "- Commercial flux model",
    custom: "- Your personalized trained models",
    imagen4: "- Google's advanced image model",
    "imagen4-ultra": "- Premium Google image model",
    photon: "- Fast photorealistic generation",
    recraft3: "- Versatile creative model",
    "recraft3-svg": "- Vector graphics generation",
    "gpt-image-1": "- GPT-powered image creation",
    seedream3: "- Artistic style model",
  }
  return descriptions[model] || ""
}

function getVideoModelDescription(model: string): string {
  const descriptions = {
    "veo-2": "- High-quality video generation",
    "veo-3": "- Advanced video model with better motion",
    "seedance-pro": "- Professional video creation",
    "seedance-lite": "- Fast video generation",
    kling: "- Creative video effects",
  }
  return descriptions[model] || ""
}

function getAspectRatioDescription(ratio: string): string {
  const descriptions = {
    "16:9": "Widescreen (landscape)",
    "1:1": "Square format",
    "21:9": "Ultra-wide cinematic",
    "2:3": "Portrait photography",
    "3:2": "Standard photo",
    "4:5": "Instagram portrait",
    "4:3": "Traditional monitor",
    "3:4": "Tall portrait",
    "5:4": "Classic frame",
    "9:16": "Mobile/Stories",
    "9:21": "Tall mobile",
  }
  return descriptions[ratio] || ""
}

export default safeEdge(handler, "create")

export const config: Config = {
  path: "/create",
}
