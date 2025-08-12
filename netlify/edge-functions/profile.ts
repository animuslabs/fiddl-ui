import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { userFindByUsername, userPublicProfile, creationsCreateImageRequests, collectionsFindCollectionByName, collectionsGetCollectionImages } from "./lib/orval.ts"
import { buildStaticTopNavHtml, escapeHtml, buildMediaListSchema } from "./lib/util.ts"
import { img, s3Video, avatarImg } from "./lib/netlifyImg.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

interface ProfileData {
  userId: string
  username: string
  bio?: string | null
  imagesCreated: number
  imagesFavorited: number
}

interface CreationItem {
  id: string
  prompt?: string
  model?: string
  aspectRatio: string
  createdAt: string
  imageIds: string[]
  customModelName?: string
  public: boolean
}

interface MediaItem {
  id: string
  url: string
  type: "image"
  prompt?: string
  model?: string
  createdAt: Date
  requestId: string
}

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const [, username] = url.pathname.split("/")

    if (!username || !username.startsWith("@")) {
      return context.next()
    }

    const cleanUsername = username.slice(1) // Remove @ prefix

    // Get user ID from username
    const userIdResponse = await userFindByUsername({ username: cleanUsername }).catch(() => null)
    if (!userIdResponse) {
      return context.next()
    }

    const userId = userIdResponse

    // Get public profile data
    const [profileResponse, creationsResponse] = await Promise.allSettled([userPublicProfile({ userId }), creationsCreateImageRequests({ userId, limit: 20, order: "desc" })])

    const profile = profileResponse.status === "fulfilled" ? profileResponse.value : null
    const creations = creationsResponse.status === "fulfilled" ? creationsResponse.value : []

    if (!profile) {
      return context.next()
    }

    const profileData: ProfileData = {
      userId,
      username: cleanUsername,
      bio: profile.profile.bio,
      imagesCreated: profile.imagesCreated,
      imagesFavorited: profile.imagesFavorited,
    }

    // Process recent creations into media items
    const mediaItems = processCreations(creations as CreationItem[])

    // Try to get user's avatar for OG image, fallback to default
    const avatarUrl = avatarImg(userId, 300)
    const ogImageUrl = (await checkImageExists(avatarUrl)) ? avatarUrl : "https://app.fiddl.art/OGImage-1.jpg"

    const pageTitle = `@${cleanUsername} | Fiddl.art`
    const description = profileData.bio
      ? `${profileData.bio} | @${cleanUsername} on Fiddl.art - ${profileData.imagesCreated} images created, ${profileData.imagesFavorited} images favorited.`
      : `@${cleanUsername} on Fiddl.art - ${profileData.imagesCreated} images created, ${profileData.imagesFavorited} images favorited. Discover their AI-generated creations.`

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        description,
        imageUrl: ogImageUrl,
        ogType: "profile",
        twitterCard: "summary",
      },
      blocks: {
        jsonLd: [buildProfileSchema(profileData, mediaItems, `${url.origin}${url.pathname}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildProfilePageHtml(profileData, mediaItems), buildProfileMediaHtml(mediaItems)],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "profile", e)
    return context.next()
  }
}

function processCreations(creations: CreationItem[]): MediaItem[] {
  const mediaItems: MediaItem[] = []

  for (const creation of creations) {
    if (!creation.public || !creation.imageIds?.length) continue

    for (const imageId of creation.imageIds) {
      mediaItems.push({
        id: imageId,
        url: img(imageId, "lg"),
        type: "image",
        prompt: creation.prompt,
        model: creation.customModelName || creation.model,
        createdAt: new Date(creation.createdAt),
        requestId: creation.id,
      })
    }
  }

  return mediaItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

function buildProfileSchema(profile: ProfileData, mediaItems: MediaItem[], pageUrl: string): string {
  const profileUrl = `https://app.fiddl.art/@${profile.username}`

  const creativeWorks = mediaItems.slice(0, 10).map((item, index) => ({
    "@type": "ImageObject",
    "@id": `https://app.fiddl.art/request/image/${item.id.slice(-8)}`,
    contentUrl: item.url,
    name: item.prompt || "AI-generated image",
    description: item.prompt || `AI-generated image by @${profile.username}`,
    dateCreated: item.createdAt.toISOString(),
    creator: {
      "@type": "Person",
      "@id": profileUrl,
      name: profile.username,
      url: profileUrl,
    },
    ...(item.model && {
      additionalProperty: {
        "@type": "PropertyValue",
        name: "model",
        value: item.model,
      },
    }),
  }))

  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": profileUrl,
    name: profile.username,
    alternateName: `@${profile.username}`,
    url: profileUrl,
    image: avatarImg(profile.userId, 300),
    ...(profile.bio && { description: profile.bio }),
    mainEntityOfPage: {
      "@type": "ProfilePage",
      "@id": pageUrl,
      name: `@${profile.username} Profile`,
      description: `Profile page for @${profile.username} on Fiddl.art`,
      isPartOf: {
        "@type": "WebSite",
        name: "Fiddl.art",
        url: "https://app.fiddl.art",
      },
    },
    ...(creativeWorks.length && {
      hasCreativeWork: creativeWorks,
    }),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "imagesCreated",
        value: profile.imagesCreated.toString(),
      },
      {
        "@type": "PropertyValue",
        name: "imagesFavorited",
        value: profile.imagesFavorited.toString(),
      },
    ],
  }

  return JSON.stringify(schema)
}

function buildProfilePageHtml(profile: ProfileData, mediaItems: MediaItem[]): string {
  const avatarUrl = avatarImg(profile.userId, 250)
  const bioHtml = profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ""

  return `
    <div id="profile-page" itemscope itemtype="https://schema.org/Person">
      <div class="profile-header">
        <div class="profile-avatar">
          <img src="${escapeHtml(avatarUrl)}" alt="@${escapeHtml(profile.username)} avatar" itemprop="image" />
        </div>
        <div class="profile-info">
          <h1 class="profile-username" itemprop="name">@${escapeHtml(profile.username)}</h1>
          ${bioHtml}
          <div class="profile-stats">
            <div class="stat-item">
              <strong class="stat-value">${profile.imagesCreated}</strong>
              <span class="stat-label">Created Images</span>
            </div>
            <div class="stat-item">
              <strong class="stat-value">${profile.imagesFavorited}</strong>
              <span class="stat-label">Images Favorited</span>
            </div>
            <div class="stat-item">
              <strong class="stat-value">${mediaItems.length}</strong>
              <span class="stat-label">Recent Public Images</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildProfileMediaHtml(mediaItems: MediaItem[]): string {
  if (!mediaItems.length) {
    return `
      <div id="profile-media">
        <h2>Recent Creations</h2>
        <p class="no-media">No public creations found.</p>
      </div>
    `
  }

  const mediaHtml = mediaItems
    .map((item) => {
      const mediaUrl = `/request/image/${item.id.slice(-8)}`
      const promptText = item.prompt ? escapeHtml(item.prompt.slice(0, 150) + (item.prompt.length > 150 ? "..." : "")) : ""
      const modelInfo = item.model ? `<span class="media-model">Model: ${escapeHtml(item.model)}</span>` : ""

      return `
      <div class="media-item" itemscope itemtype="https://schema.org/ImageObject">
        <a href="${escapeHtml(mediaUrl)}" class="media-link">
          <div class="media-preview">
            <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.prompt || "AI-generated image")}" loading="lazy" itemprop="contentUrl" />
          </div>
          <div class="media-info">
            ${promptText ? `<p class="media-prompt" itemprop="description">${promptText}</p>` : ""}
            <div class="media-meta">
              <span class="media-date" itemprop="dateCreated">${item.createdAt.toLocaleDateString()}</span>
              ${modelInfo}
            </div>
          </div>
        </a>
      </div>
    `
    })
    .join("")

  return `
    <div id="profile-media">
      <h2>Recent Public Creations</h2>
      <div class="media-grid">
        ${mediaHtml}
      </div>
    </div>
  `
}

export default safeEdge(handler, "profile")

export const config: Config = {
  path: "/@:username",
}
