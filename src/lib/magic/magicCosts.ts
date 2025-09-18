import { prices } from "src/stores/pricesStore"

// Helper: price of a single custom image for a given base model
// Custom image = base model image price + custom model surcharge
export function customImagePriceForBase(base: "fluxDev" | "fluxPro" | "fluxProUltra"): number {
  const map: Record<typeof base, keyof typeof prices.image.model> = {
    fluxDev: "flux-dev",
    fluxPro: "flux-pro",
    fluxProUltra: "flux-pro-ultra",
  } as const
  const baseKey = map[base]
  const basePrice = prices.image?.model?.[baseKey] || 0
  const surcharge = prices.forge?.customModelCharge || 0
  return basePrice + surcharge
}

// Total points required for Magic Mirror Pro
// = training set creation + train Flux Dev base + 3 custom Flux Dev images
export function magicMirrorProTotalPoints(): number {
  const trainingSet = prices.forge?.createTrainingSet || 0
  const trainFluxDev = prices.forge?.trainBaseModel?.fluxDev || 0
  const customFluxDevImage = customImagePriceForBase("fluxDev")
  return trainingSet + trainFluxDev + customFluxDevImage * 3
}

// Total points required for Magic Mirror Fast
// = 3 nano-banana images + 4 image uploads
export function magicMirrorFastTotalPoints(): number {
  const banana = prices.image?.model?.["nano-banana"] || 0
  const upload = prices.image?.uploadSoloImage || 0
  return banana * 3 + upload * 4
}

