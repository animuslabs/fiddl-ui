<template lang="pug">
div
  .centered
    h6.q-mt-none.q-mb-none Buy 2,000 Fiddl Points
  .centered.text-secondary
    small $17 — instant credit to your account
  .centered.q-mt-sm
    div.bg-white(ref="paypal" class="paypal-container q-pa-md")
  .centered.q-mt-sm
    q-btn(type="a" flat color="primary" no-caps :to="{ name: 'addPoints' }" label="More options on Add Points page")
</template>

<style lang="sass" scoped>
.paypal-container
  border-radius: 14px
  width: 100%
  max-width: 420px
</style>

<script lang="ts">
import { defineComponent, nextTick } from "vue"
import { loadPayPal } from "lib/payPal"
import { pointsPackagesAvailable, pointsInitBuyPackage, pointsFinishBuyPackage } from "src/lib/orval"
import { PayPalButtonsComponent, PayPalNamespace } from "@paypal/paypal-js"
import { useUserAuth } from "stores/userAuth"
import { Dialog } from "quasar"
import { catchErr, throwErr, getCookie } from "lib/util"
import umami from "lib/umami"
import { metaPixel } from "lib/metaPixel"

export default defineComponent({
  name: "BuyPointsMini",
  emits: ["paymentComplete"],
  data() {
    return {
      userAuth: useUserAuth(),
      payPal: null as null | PayPalNamespace,
      ppButton: null as null | PayPalButtonsComponent,
      selectedPkgIndex: 2 as number | null,
      selectedUsd: 17 as number | null,
      selectedPoints: 2000 as number | null,
      isRenderingPaypal: false,
    }
  },
  async mounted() {
    try {
      const { data: pkgs } = await pointsPackagesAvailable()
      let targetIndex = -1
      if (Array.isArray(pkgs)) {
        targetIndex = pkgs.findIndex((p: any) => Number(p.points) === 2000)
        if (targetIndex < 0) targetIndex = pkgs.findIndex((p: any) => Math.abs(Number(p.usd) - 17) < 0.01)
        if (targetIndex < 0) targetIndex = pkgs.length > 2 ? 2 : pkgs.length - 1
        targetIndex = Math.max(0, targetIndex)
        const t = pkgs[targetIndex]
        this.selectedPkgIndex = targetIndex
        this.selectedUsd = Number(t?.usd || 17)
        this.selectedPoints = Number(t?.points || 2000)
      }
    } catch {
      // Fallback defaults already set
    }
    await this.ensurePaypalRendered()
  },
  beforeUnmount() {
    this.teardownPaypal()
  },
  methods: {
    teardownPaypal() {
      try {
        const closeFn = this.ppButton && (this.ppButton as any).close
        if (typeof closeFn === "function") {
          void closeFn.call(this.ppButton)
        }
      } catch {}
      const el = this.$refs.paypal as HTMLDivElement
      if (el) el.innerHTML = ""
      this.ppButton = null
    },
    async ensurePaypalRendered(attempt = 0) {
      const maxAttempts = 40
      const delayMs = 50
      const container = this.$refs.paypal as HTMLDivElement | undefined
      const visible = !!container && container.offsetParent !== null && container.getBoundingClientRect().width > 0 && container.getBoundingClientRect().height > 0
      if (!container || !visible) {
        if (attempt < maxAttempts) {
          setTimeout(() => this.ensurePaypalRendered(attempt + 1), delayMs)
        }
        return
      }
      const el = this.$refs.paypal as HTMLDivElement
      if (!this.payPal) {
        this.payPal = await loadPayPal()
      }
      if (!this.ppButton) {
        this.ppButton = this.payPal!.Buttons({
          style: { label: "pay" },
          message: { amount: this.selectedUsd || 17, position: "bottom", color: "black" },
          createOrder: async () => {
            if (this.selectedPkgIndex == null) throwErr("Failed to create order")
            const res = await pointsInitBuyPackage({ method: "payPal", packageId: this.selectedPkgIndex }).catch(catchErr)
            if (!res?.data) return ""
            try {
              metaPixel.trackInitiateCheckout({
                currency: "USD",
                value: Number(this.selectedUsd || 0),
                num_items: 1,
                content_type: "product",
                contents: [{ id: `points_${this.selectedPoints || 0}`, quantity: 1, item_price: Number(this.selectedUsd || 0) }],
                content_name: `Fiddl Points ${this.selectedPoints || 0}`
              })
            } catch {}
            return (res.data as any).id || ""
          },
          onApprove: async (data: any, actions: any) => {
            try {
              const datafastVisitorId = getCookie("datafast_visitor_id")
              const res = await pointsFinishBuyPackage({ method: "payPal", orderId: data.orderID, trackingId: datafastVisitorId || undefined })
              if (!res?.data) {
                throwErr("Failed to capture order")
                return
              }
              void this.userAuth.loadUserData()
              try {
                metaPixel.trackPurchase({
                  currency: "USD",
                  value: Number(this.selectedUsd || 0),
                  num_items: 1,
                  content_type: "product",
                  contents: [{ id: `points_${this.selectedPoints || 0}`, quantity: 1, item_price: Number(this.selectedUsd || 0) }],
                  content_name: `Fiddl Points ${this.selectedPoints || 0}`
                })
              } catch {}
              umami.track && umami.track("buyPointsPkgSuccess", { points: this.selectedPoints, paid: this.selectedUsd })
              this.$emit("paymentComplete")
            } catch (error: any) {
              if (error?.response?.data?.details?.[0]?.issue === "INSTRUMENT_DECLINED") {
                return actions.restart()
              }
              const errorDetail = error?.response?.data?.details?.[0] || { description: "Unknown error occurred" }
              Dialog.create({ title: "Error", message: errorDetail.description, ok: true })
              throwErr("Failed to capture order: " + errorDetail.description)
            }
          },
        })
        await nextTick()
        const el2 = this.$refs.paypal as HTMLDivElement
        if (el2) {
          await this.ppButton!.render(el2)
        }
      } else {
        void this.ppButton.updateProps({
          message: { amount: this.selectedUsd || 17, position: "bottom", color: "black" },
        })
      }
    },
  },
})
</script>