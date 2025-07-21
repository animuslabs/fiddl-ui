import { pointsPrices, type PointsPrices200 } from "lib/orval"
import { throwErr } from "lib/util"
import { reactive } from "vue"

export const prices = reactive<PointsPrices200>({
  image: {
    unlock: 12,
    unlockCommission: 4,
    model: {
      "flux-dev": 6,
      "flux-pro": 10,
      "flux-pro-ultra": 15,
      core: 8,
      "sd3-lg": 10,
      ultra: 15,
      imagen4: 10,
      "imagen4-ultra": 15,
      photon: 8,
      recraft3: 10,
      "recraft3-svg": 20,
      "dall-e-3": 25,
      "gpt-image-1": 22,
      custom: 10,
    },
  },
  forge: {
    createTrainingSet: 100,
    trainBaseModel: {
      fluxDev: 500,
      fluxPro: 750,
      fluxProUltra: 1_000,
      faceClone: 1_500,
      faceForge: 2_000,
    },
    fineTuneType: { lora: 400, full: 1_200 },
    customModelOwnerComission: 1,
    customModelCharge: 3,
  },
  video: {
    unlock: 50,
    unlockCommission: 15,
    model: {
      "seedance-lite": 10,
      "seedance-pro": 35,
      kling: 15,
      "veo-2": 130,
      "veo-3": 195,
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
    improvePrompt: 2,
    randomPrompt: 1,
  },
})
async function reloadPrices() {
  const newPrices = await pointsPrices().catch(console.error)
  if (newPrices) Object.assign(prices, newPrices)
}

export function usePricesStore() {
  return {
    prices,
    reloadPrices,
  }
}
