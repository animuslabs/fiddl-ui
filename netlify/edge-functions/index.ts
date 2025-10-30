import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, buildAssetLicenseMetadata } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)

    const pageTitle = "Fiddl.art - Create and Earn with AI Art"
    const description = "Create stunning AI-generated images and videos, discover amazing artwork from the community, and earn money from your creations. Join thousands of artists using cutting-edge AI tools."

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        description,
        imageUrl: "https://app.fiddl.art/fiddlSocialCard.jpg",
        ogType: "website",
      },
      blocks: {
        jsonLd: [buildHomepageSchema(`${url.origin}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildHeroSectionHtml(), buildValuePropositionsHtml(), buildFeaturesHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "index", e)
    return context.next()
  }
}

function buildHomepageSchema(siteUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": siteUrl,
    name: "Fiddl.art",
    alternateName: "Fiddl",
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/fiddlLogoWithText-hor.svg`,
      ...buildAssetLicenseMetadata({}),
    },
    description: "AI-powered art creation platform where artists create, discover, and earn from AI-generated artwork",
    slogan: "Create and Earn with AI Art",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web Browser",
    mainEntity: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Fiddl.art",
      description: "Create stunning AI art, discover community creations, and earn from your artwork",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/browse?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  }

  return JSON.stringify(schema)
}

function buildHeroSectionHtml(): string {
  return `
    <div id="homepage-hero">
      <div class="hero-content">
        <h1>Create and Earn with AI Art</h1>
        <p class="hero-description">
          Transform your imagination into stunning AI-generated artwork. Join thousands of creators using
          cutting-edge artificial intelligence to create, discover, and monetize digital art.
        </p>
        <div class="hero-actions">
          <a href="/create">Get Started Free</a>
          <a href="/browse">Explore Gallery</a>
        </div>
      </div>
    </div>
  `
}

function buildValuePropositionsHtml(): string {
  return `
    <div id="value-propositions">
      <h2>What You Can Do on Fiddl.art</h2>
      <div class="value-props-grid">
        <div class="value-prop-item">
          <h3>Create AI Art</h3>
          <p>Create AI art with Fiddl's easy-to-use tools and the latest models.</p>
          <ul>
            <li>15+ Premium AI Models</li>
            <li>Image and Video Generation</li>
            <li>Custom Model Training</li>
            <li>High-Resolution Output</li>
          </ul>
        </div>

        <div class="value-prop-item">
          <h3>Discover Community Art</h3>
          <p>Search, filter, and collect AI art created by the Fiddl community.</p>
          <ul>
            <li>Browse Latest Creations</li>
            <li>Advanced Search & Filters</li>
            <li>Follow Favorite Artists</li>
            <li>Curated Collections</li>
          </ul>
        </div>

        <div class="value-prop-item">
          <h3>Earn from Your Art</h3>
          <p>Earn money by selling your creations and custom models on Fiddl.</p>
          <ul>
            <li>Sell Digital Artwork</li>
            <li>License Custom Models</li>
            <li>Creator Royalties</li>
            <li>Flexible Pricing</li>
          </ul>
        </div>

        <div class="value-prop-item">
          <h3>Customize with Forge</h3>
          <p>Put yourself inside the artwork by uploading your photos and training custom models.</p>
          <ul>
            <li>Face Clone Technology</li>
            <li>Style Training</li>
            <li>Object Recognition</li>
            <li>Personal Model Library</li>
          </ul>
        </div>
      </div>
    </div>
  `
}

function buildFeaturesHtml(): string {
  return `
    <div id="features">
      <h2>Platform Features</h2>

      <div class="features-section">
        <h3>AI Models Available</h3>
        <p>Access to cutting-edge AI models for image and video generation including DALL-E 3, Flux, Stable Diffusion, and more.</p>
      </div>

      <div class="features-section">
        <h3>Creation Tools</h3>
        <p>Professional-grade tools for prompt engineering, batch generation, aspect ratio control, and advanced customization options.</p>
      </div>

      <div class="features-section">
        <h3>Community & Marketplace</h3>
        <p>Connect with other creators, share your work, discover trending art, and participate in the creative economy.</p>
      </div>

      <div class="features-section">
        <h3>Custom Model Training</h3>
        <p>Train personalized AI models with your own images using advanced techniques like LoRA and full fine-tuning.</p>
      </div>

      <div class="getting-started">
        <h3>Ready to Get Started?</h3>
        <p>Join thousands of creators using AI to make amazing art. Sign up for free and start creating today.</p>
        <div class="cta-links">
          <a href="/create">Start Creating</a>
          <a href="/models">Browse Models</a>
          <a href="/browse">View Gallery</a>
        </div>
      </div>
    </div>
  `
}

export default safeEdge(handler, "index")

export const config: Config = {
  path: "/",
}
