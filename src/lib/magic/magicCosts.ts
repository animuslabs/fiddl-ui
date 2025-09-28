import { prices } from "src/stores/pricesStore"

function privateTaxRate(): number {
  const tax = prices.privateTax
  if (typeof tax === "number" && Number.isFinite(tax)) return Math.max(0, tax) / 100
  return 0
}

export function applyPrivateTax(amount: number): number {
  const base = typeof amount === "number" && Number.isFinite(amount) ? amount : 0
  if (base <= 0) return 0

  const rate = privateTaxRate()
  if (rate <= 0) return base

  return base + Math.ceil(base * rate)
}

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
  const customFluxDevImage = applyPrivateTax(customImagePriceForBase("fluxDev"))
  return trainingSet + trainFluxDev + customFluxDevImage * 3
}

// Total points required for Magic Mirror Fast
// = For each look, run 2 models (seedream4 + nano-banana) + 4 uploads total
export function magicMirrorFastTotalPoints(): number {
  const sd4 = prices.image?.model?.["seedream4"] || 0
  const banana = prices.image?.model?.["nano-banana"] || 0
  const upload = prices.image?.uploadSoloImage || 0
  const perLook = applyPrivateTax(sd4) + applyPrivateTax(banana)
  return perLook * 3 + upload * 4
}
