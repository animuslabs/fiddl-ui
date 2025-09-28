import { pointsPrices, type PointsPrices200 } from "lib/orval"
import { throwErr } from "lib/util"
import { reactive } from "vue"

export const prices = reactive<PointsPrices200>({
  image: {
    uploadSoloImage: 4,
    unlock: 12, // creator earns 4
    unlockCommission: 4,
    model: {
      core: 9,
      "sd3-lg": 11,
      ultra: 16,
      "flux-dev": 7,
      "flux-pro": 13,
      "flux-pro-ultra": 19,
      "flux-kontext": 13,
      imagen4: 11,
      "imagen4-ultra": 16,
      photon: 9,
      recraft3: 11,
      "recraft3-svg": 21,
      "dall-e-3": 26,
      "gpt-image-1": 23,
      custom: 11,
      seedream3: 10,
      seedream4: 13,
      seedream4k: 20,
      "nano-banana": 13,
    },
  },
  forge: {
    createTrainingSet: 10,
    trainBaseModel: {
      fluxDev: 600,
      fluxPro: 850,
      fluxProUltra: 1_200,
      faceClone: 1_500,
      faceForge: 2_000,
    },
    fineTuneType: { lora: 500, full: 1_500 },
    customModelOwnerComission: 1,
    customModelCharge: 2,
  },
  video: {
    unlock: 50,
    unlockCommission: 15,
    model: {
      "seedance-lite": 25,
      "seedance-pro": 45,
      kling: 25,
      "veo-2": 150,
      "veo-3": 200,
    },
  },
  socialRewards: {
    linkEmail: 100,
    linkGoogle: 100,
    linkPhone: 100,
    linkTelegram: 100,
    linkTwitter: 100,
  },
  promptTools: {
    improvePrompt: 3,
    randomPrompt: 2,
  },
  privateTax: 5,
})
async function reloadPrices() {
  const newPrices = await pointsPrices().catch(console.error)
  // console.log("[pricesStore] API response (newPrices):", newPrices)
  // console.log("[pricesStore] prices before update:", JSON.parse(JSON.stringify(prices)))
  if (newPrices?.data) Object.assign(prices, newPrices.data)
  // console.log("[pricesStore] prices after update:", JSON.parse(JSON.stringify(prices)))
}

export function usePricesStore() {
  return {
    prices,
    reloadPrices,
  }
}
