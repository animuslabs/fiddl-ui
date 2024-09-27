import { z } from "zod"

export const imageModels = ["ultra", "sd3-lg", "core"] as const
export type ImageModel = (typeof imageModels)[number]
export type ImageModelData = { name: ImageModel; pointsCost: number }
// Ensure imageModelDatas is declared as const
export const imageModelDatas: ImageModelData[] = [
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
