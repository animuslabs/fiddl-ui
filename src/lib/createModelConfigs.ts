import type { CustomModelMode, FineTuneType, CustomModelType } from "fiddl-server/node_modules/@prisma/client"

interface BaseModelData {
  name: "Flux Dev" | "Flux Pro" | "Flux Pro Ultra"
  description: string
  value: CustomModelType
}

export const baseModels: BaseModelData[] = [
  { name: "Flux Dev", description: "Ideal for fast prototyping and tests", value: "fluxDev" },
  { name: "Flux Pro", description: "Balanced quality and realism", value: "fluxPro" },
  { name: "Flux Pro Ultra", description: "Maximum detail and realism", value: "fluxProUltra" },
]

interface TrainingModeOption {
  value: CustomModelMode
  icon: string
  description: string
}

export const trainingModes: Readonly<TrainingModeOption[]> = Object.freeze([
  {
    value: "subject",
    description: "Best for portraits, characters, and living beings.",
    icon: "sym_o_frame_person",
  },
  {
    value: "style",
    description: "Learn and mimic a specific art style or mood.",
    icon: "sym_o_palette",
  },
  {
    value: "object",
    description: "Ideal for objects and products where detail matters.",
    icon: "view_in_ar",
  },
  {
    value: "general",
    description: "Versatile mode for environments, architecture, and more.",
    icon: "sym_o_asterisk",
  },
])

export const fineTuneTypeData: Readonly<FineTuneTypeData[]> = Object.freeze([
  {
    label: "Normal",
    value: "lora",
    description: "Builds on the base model using your images. Best for small datasets (<30).",
  },
  {
    label: "Advanced",
    value: "full",
    description: "Fully retrains the base model. Requires 30+ high-quality images for best results. Not available for Flux Dev.",
  },
])

interface FineTuneTypeData {
  label: string
  value: FineTuneType
  description: string
}
