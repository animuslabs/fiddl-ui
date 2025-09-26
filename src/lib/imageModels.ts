export const imageModels = [
  "ultra",
  "sd3-lg",
  "core",
  "dall-e-3",
  "flux-pro-ultra",
  "flux-dev",
  "flux-pro",
  "flux-kontext",
  "custom",
  "imagen4", //
  "imagen4-ultra", //
  "photon",
  "recraft3",
  "recraft3-svg",
  "gpt-image-1",
  "seedream3",
  "seedream4",
  "seedream4k",
  "nano-banana",
] as const
export type ImageModel = (typeof imageModels)[number]

export const videoModels = ["veo-2", "veo-3", "seedance-pro", "kling", "seedance-lite"] as const
export type AnyModel = ImageModel | VideoModel

export type VideoModel = (typeof videoModels)[number]
export interface VideoModelData {
  name: VideoModel
  pointsCostPerSecond: number
}

export const modelTags = ["Image", "Video", "Realistic", "Creative", "Illustrative", "DesignText", "Precision", "Vibrant", "Versatile", "FastBudget", "Vector", "Multimodal", "Bilingual", "Custom", "Cinematic", "MultiCamera", "Audio", "Dramatic", "Experimental"] as const
export type ModelTags = (typeof modelTags)[number]

export const aspectRatios = ["16:9", "1:1", "21:9", "2:3", "3:2", "4:5", "4:3", "3:4", "5:4", "9:16", "9:21"] as const
export type AspectRatio = (typeof aspectRatios)[number]
export type AspectRatioGrade = "wide" | "square" | "extraWide" | "tall" | "extraTall"
export const ratioRatings: Record<AspectRatio, AspectRatioGrade> = {
  "16:9": "wide",
  "1:1": "square",
  "21:9": "extraWide",
  "2:3": "tall",
  "3:2": "wide",
  "4:5": "square",
  "5:4": "square",
  "9:16": "extraTall",
  "9:21": "extraTall",
  "4:3": "square",
  "3:4": "square",
}
