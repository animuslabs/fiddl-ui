export const imageModels = [
  "ultra",
  "sd3-lg",
  "core",
  "dall-e-3",
  "flux-pro-ultra",
  "flux-dev",
  "flux-pro",
  "custom",
  "imagen4", //
  "imagen4-ultra", //
  "photon",
  "recraft3",
  "recraft3-svg",
  "gpt-image-1",
] as const
export type ImageModel = (typeof imageModels)[number]
export const imageModelDatas: { name: ImageModel; pointsCost: number }[] = [
  {
    name: "imagen4",
    pointsCost: 8,
  },
  {
    name: "gpt-image-1",
    pointsCost: 18,
  },
  {
    name: "imagen4-ultra",
    pointsCost: 16,
  },
  {
    name: "photon",
    pointsCost: 6,
  },
  {
    name: "recraft3",
    pointsCost: 12,
  },
  {
    name: "recraft3-svg",
    pointsCost: 16,
  },
  {
    name: "ultra",
    pointsCost: 16,
  },
  {
    name: "sd3-lg",
    pointsCost: 8,
  },
  {
    name: "core",
    pointsCost: 6,
  },
  {
    name: "dall-e-3",
    pointsCost: 20,
  },
  {
    name: "flux-pro-ultra",
    pointsCost: 20,
  },
  {
    name: "flux-pro",
    pointsCost: 16,
  },
  {
    name: "flux-dev",
    pointsCost: 8,
  },
  {
    name: "custom",
    pointsCost: 8,
  },
]

export const videoModels = ["veo-2", "veo-3", "seedance-pro", "kling", "seedance-lite"] as const
export interface VideoModelData {
  name: (typeof videoModels)[number]
  pointsCostPerSecond: number
}

export const videoModelDatas: VideoModelData[] = [
  {
    name: "veo-2",
    pointsCostPerSecond: 45,
  },
  {
    name: "veo-3",
    pointsCostPerSecond: 75,
  },
  {
    name: "seedance-pro",
    pointsCostPerSecond: 70,
  },
  {
    name: "seedance-pro",
    pointsCostPerSecond: 55,
  },
  {
    name: "kling",
    pointsCostPerSecond: 65,
  },
]

export const aspectRatios = ["16:9", "1:1", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"] as const
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
}
