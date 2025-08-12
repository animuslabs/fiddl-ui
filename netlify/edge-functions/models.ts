import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { modelsGetBaseModels, modelsGetPublicModels, type ModelsGetBaseModels200Item, type ModelsGetPublicModels200Item } from "./lib/orval.ts"
import { buildStaticTopNavHtml, escapeHtml, type MediaItem } from "./lib/util.ts"
import { img } from "./lib/netlifyImg.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

type AnyModel = ModelsGetBaseModels200Item | (ModelsGetPublicModels200Item & { creatorId: string })

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const [, , filterTag] = url.pathname.split("/")

    // Fetch both base models and public models
    const [baseModelsResponse, publicModelsResponse] = await Promise.allSettled([modelsGetBaseModels(), modelsGetPublicModels({ tag: filterTag ? (filterTag as any) : undefined })])

    const baseModels = baseModelsResponse.status === "fulfilled" ? baseModelsResponse.value : []
    const publicModels = publicModelsResponse.status === "fulfilled" ? publicModelsResponse.value : []

    // Transform public models to match the expected format
    const customModels: (ModelsGetPublicModels200Item & { creatorId: string })[] = publicModels.map((model) => ({
      ...model,
      creatorId: model.creatorId,
    }))

    // Filter base models by tag if provided
    const filteredBaseModels = filterTag ? baseModels.filter((model) => model.modelTags.includes(filterTag as any)) : baseModels

    // Combine and sort models (featured first, then by update date)
    const allModels: AnyModel[] = [...filteredBaseModels, ...customModels].sort((a, b) => {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    const pageTitle = filterTag ? `${filterTag} Models | Fiddl.art` : "AI Models | Fiddl.art"
    const description = filterTag
      ? `Explore ${filterTag} AI models on Fiddl.art. Create stunning ${filterTag.toLowerCase()} content with our curated selection of AI models.`
      : "Discover and use powerful AI models for image and video generation. Browse our collection of base models and community-created custom models on Fiddl.art."

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
        jsonLd: [buildModelsListSchema(allModels, `${url.origin}${url.pathname}`, filterTag)],
        htmlBlocks: [buildStaticTopNavHtml(), buildModelsPageHtml(allModels, filterTag), buildModelsCategoryHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "models", e)
    return context.next()
  }
}

function buildModelsListSchema(models: AnyModel[], pageUrl: string, filterTag?: string): string {
  const modelItems = models.slice(0, 20).map((model, index) => {
    const modelUrl = "creatorId" in model && model.creatorId ? `https://app.fiddl.art/model/custom/${model.id}` : `https://app.fiddl.art/model/${model.slug}`

    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "CreativeWork",
        "@id": modelUrl,
        name: model.name,
        description: model.description || "",
        url: modelUrl,
        dateModified: model.updatedAt,
        keywords: model.modelTags?.join(", ") || "",
        ...(model.featured && {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "featured",
            value: "true",
          },
        }),
        ...("creatorId" in model &&
          model.creatorId && {
            creator: {
              "@type": "Organization",
              name: "Community Creator",
            },
          }),
      },
    }
  })

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": pageUrl,
    name: filterTag ? `${filterTag} AI Models` : "AI Models Directory",
    description: filterTag ? `Collection of ${filterTag} AI models for creative content generation` : "Comprehensive directory of AI models for image and video generation",
    url: pageUrl,
    numberOfItems: models.length,
    itemListElement: modelItems,
    mainEntity: {
      "@type": "WebPage",
      "@id": pageUrl,
      name: filterTag ? `${filterTag} Models` : "AI Models",
      description: filterTag ? `Browse ${filterTag} AI models on Fiddl.art` : "Browse AI models on Fiddl.art",
      isPartOf: {
        "@type": "WebSite",
        name: "Fiddl.art",
        url: "https://app.fiddl.art",
      },
    },
  }

  return JSON.stringify(schema)
}

function buildModelsPageHtml(models: AnyModel[], filterTag?: string): string {
  const headerText = filterTag ? `${filterTag} Models` : "All Models"
  const modelCount = models.length

  const modelsHtml = models
    .map((model) => {
      const modelUrl = "creatorId" in model && model.creatorId ? `/model/custom/${model.id}` : `/model/${model.slug}`

      const imageUrl = model.previewMediaId ? img(model.previewMediaId, "md") : "/fiddlLogo.webp"

      const tagsHtml = model.modelTags?.map((tag) => `<span class="model-tag">${escapeHtml(tag)}</span>`).join("") || ""

      const featuredBadge = model.featured ? '<span class="featured-badge">Featured</span>' : ""

      const creatorInfo = "creatorId" in model && model.creatorId ? '<span class="model-creator">Community Model</span>' : '<span class="model-creator">Base Model</span>'

      return `
      <div class="model-card">
        <a href="${escapeHtml(modelUrl)}" class="model-link">
          <div class="model-preview">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(model.name)}" loading="lazy" />
            ${featuredBadge}
          </div>
          <div class="model-info">
            <h3 class="model-name">${escapeHtml(model.name)}</h3>
            ${model.description ? `<p class="model-description">${escapeHtml(model.description)}</p>` : ""}
            <div class="model-meta">
              ${creatorInfo}
              <span class="model-updated">Updated: ${new Date(model.updatedAt).toLocaleDateString()}</span>
            </div>
            <div class="model-tags">
              ${tagsHtml}
            </div>
          </div>
        </a>
      </div>
    `
    })
    .join("")

  return `
    <div id="models-page">
      <header class="models-header">
        <h1>${escapeHtml(headerText)}</h1>
        <p class="models-count">${modelCount} models available</p>
        ${filterTag ? `<p class="filter-info">Showing models tagged with "${escapeHtml(filterTag)}"</p>` : ""}
      </header>
      <div class="models-grid">
        ${modelsHtml || '<p class="no-models">No models found matching your criteria.</p>'}
      </div>
    </div>
  `
}

function buildModelsCategoryHtml(): string {
  const categories = [
    { name: "Image", description: "AI models for image generation", href: "/models/Image" },
    { name: "Video", description: "AI models for video generation", href: "/models/Video" },
    { name: "Realistic", description: "Models focused on photorealistic results", href: "/models/Realistic" },
    { name: "Creative", description: "Artistic and creative models", href: "/models/Creative" },
    { name: "Custom", description: "Community-created custom models", href: "/models/Custom" },
  ]

  const categoriesHtml = categories
    .map(
      (category) => `
    <div class="category-card">
      <a href="${escapeHtml(category.href)}" class="category-link">
        <h3 class="category-name">${escapeHtml(category.name)}</h3>
        <p class="category-description">${escapeHtml(category.description)}</p>
      </a>
    </div>
  `,
    )
    .join("")

  return `
    <div id="models-categories">
      <h2>Browse by Category</h2>
      <div class="categories-grid">
        ${categoriesHtml}
      </div>
    </div>
  `
}

export default safeEdge(handler, "models")

export const config: Config = {
  path: "/models/:filterTag?",
}
