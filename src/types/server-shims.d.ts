// Lightweight shims to satisfy type-checking in the UI repo

declare module 'fiddl-server/dist/lib/types/serverTypes' {
  export type ImageSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  export type SortMethod = 'latest' | 'popular' | 'shuffle'

  // Creation requests – use loose shapes for UI-only typing
  export interface CreateImageRequest {
    prompt: string
    model: string
    aspectRatio?: string
    public?: boolean
    quantity?: number
    seed?: number
    customModelId?: string
    customModelName?: string
    uploadedStartImageIds?: string[]
    startImageIds?: string[]
    negativePrompt?: string
  }
  export type CreateImageRequestData = CreateImageRequest

  export interface CreateVideoRequest {
    prompt: string
    model: 'veo-2' | 'veo-3' | 'seedance-pro' | 'kling' | 'seedance-lite'
    public?: boolean
    // UI uses the following optional fields
    aspectRatio?: string
    duration?: number
    durationSeconds?: number
    seed?: number
    startImageId?: string
    uploadedStartImageId?: string
    startImageIds?: string[]
    uploadedStartImageIds?: string[]
    quantity?: number
  }
  export interface CreateVideoRequestData extends CreateVideoRequest {
    id?: string
    createdAt?: string
    creatorId?: string
    videoIds?: string[]
  }

  export interface CreateImageRequestData extends CreateImageRequest {
    id?: string
    createdAt?: string
    creatorId?: string
    imageIds?: string[]
  }
}

declare module 'fiddl-server/node_modules/@prisma/client' {
  export type CustomModelType = 'fluxDev' | 'fluxPro' | 'fluxProUltra'
  export type FineTuneType = 'lora' | 'full'
  export type CustomModelMode = 'subject' | 'style' | 'object' | 'general'
  export type VideoRequest = any
}

declare module 'fiddl-server/dist/lib/db' {
  export type Prisma = any
}
