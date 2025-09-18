<template lang="pug">
div
  // Package selection (toggleable)
  q-slide-transition
    div(v-show="showPackages")
      .q-mb-sm
        h6.q-mt-xs.q-mb-sm Select a package
      div(class="packages-grid")
        q-card.q-pa-md.pkg-card.cursor-pointer(v-for="(pkg, index) in packages" :key="index" @click="setSelected(index)" :class="pkgCardClass(pkg, index)")
          .row.items-center.justify-between
            h5.q-my-none +{{ pkg.points.toLocaleString() }}
            q-img(src="/FiddlPointsLogo-sm.svg" height="32px" width="32px")
          .row.q-mt-sm.items-center.q-gutter-xs
            q-badge(:color="pkg.discountPct > 0 ? 'positive' : 'dark'" :text-color="'white'" :label="pkg.discountPct > 0 ? (pkg.discountPct * 100 + '% OFF') : 'Standard'")
          .row.items-center.justify-between.q-mt-sm
            h6.q-my-none ${{ pkg.usd }}
      .centered.q-mt-md
        q-btn(flat color="primary" icon="done" label="Done selecting" no-caps @click="showPackages=false")

  // Summary + discount + payment
  div(v-show="!showPackages")
    // Visual selected package card for consistency with selection grid
    .centered(v-if="selectedPkg")
      q-card.q-pa-md.pkg-card.active.cursor-pointer(@click="showPackages=true" style="max-width:420px; width:100%")
        .row.items-center.justify-between
          h5.q-my-none +{{ selectedPkg.points.toLocaleString() }}
          q-img(src="/FiddlPointsLogo-sm.svg" height="32px" width="32px")
        .row.q-mt-sm.items-center.q-gutter-xs
          q-badge(:color="selectedPkg.discountPct > 0 ? 'positive' : 'dark'" :text-color="'white'" :label="selectedPkg.discountPct > 0 ? (selectedPkg.discountPct * 100 + '% OFF') : 'Standard'")
        .row.items-center.justify-between.q-mt-sm
          h6.q-my-none ${{ selectedPkg.usd }}
    .centered(v-else)
      h6.q-mt-none.q-mb-none Choose a package to continue
    .centered.q-mt-xs
      q-btn(flat dense color="primary" icon="select_all" label="Select different package" no-caps @click="showPackages=true")

    // Discount code box
    q-card.q-mt-md
      q-card-section
        .centered
          h6.q-mb-sm Enter Discount Code
        .centered.items-center.q-gutter-sm.discount-row.q-mb-sm
          .col-auto
            q-input.code-input(
              v-model="discountInput"
              debounce="300"
              dense
              outlined
              rounded
              clearable
              color="primary"
              :input-style="{ fontSize: '22px', letterSpacing: '0.06em', fontWeight: '600' }"
              input-class="text-uppercase"
              :disable="!!(discountStatus && discountStatus.ok)"
              @keyup.enter="applyDiscount"
            )
          .col-auto
            q-btn(color="primary" v-if="discountStatus && (!discountStatus.ok)" :loading="discountChecking" label="Apply" @click="applyDiscount" :disable="!normalizedDiscount || selectedPkgIndex == null || !!(discountStatus && discountStatus.ok)")
            q-btn(v-if="discountStatus && (discountStatus.ok || discountInput)" flat color="grey" icon="close" class="q-ml-sm" label="Clear" @click="clearDiscount")
        div(v-if="discountStatus && discountStatus.ok" class="q-mt-sm")
          q-banner(rounded class="bg-positive text-white")
            template(#avatar)
              q-icon(name="verified" color="white")
            div
              b {{ Math.round((discountStatus.discountPct || 0) * 100) }}% off applied
        div(v-else-if="discountStatus && !discountStatus.ok && manualApplyAttempted" class="q-mt-sm")
          q-banner(rounded class="bg-negative text-white")
            template(#avatar)
              q-icon(name="error" color="white")
            div
              span(v-if="discountStatus.reason === 'not_found'") Code not found. Please check the spelling.
              span(v-else-if="discountStatus.reason === 'exhausted'") This code has reached the maximum number of uses.
      q-separator
      q-card-section(v-if="discountStatus?.ok && selectedPkg")
        .row.items-center.q-gutter-md
          .col-auto
            div Original: ${{ selectedPkg.usd }}
          .col-auto(v-if="codeDiscountPct > 0")
            div Discount: -{{ Math.round(codeDiscountPct * 100) }}%
          .col-auto
            div Final: ${{ finalUsdString }}

    // PayPal area
    .centered.q-mt-md
      div.bg-white(ref="paypal" class="paypal-container q-pa-md")

    .centered.q-mt-sm
      q-btn(type="a" flat color="primary" no-caps :to="{ name: 'addPoints' }" label="More options on Add Points page")
</template>

<style lang="sass" scoped>
.packages-grid
  display: grid
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))
  gap: 12px

.pkg-card
  transition: transform .15s ease, box-shadow .15s ease
  &:hover
    transform: translateY(-2px)

.pkg-card.active
  outline: 2px solid var(--q-primary)
  box-shadow: 0 0 0 2px rgba(0,0,0,0.2)

.paypal-container
  border-radius: 14px
  width: 100%
  max-width: 420px
  // Maintain space so removing/adding the iframe doesn't collapse layout on mobile
  min-height: 260px

.discount-row
  flex-wrap: wrap

.code-input
  width: 260px
  max-width: 100%
  :deep(.q-field__label)
    color: rgba(0, 0, 0, 0.7)
    font-weight: 600
</style>

<script lang="ts">
import { defineComponent, nextTick } from "vue"
import { LocalStorage, Notify } from "quasar"
import { loadPayPal } from "lib/payPal"
import { pointsPackagesAvailable, pointsInitBuyPackage, pointsFinishBuyPackage } from "src/lib/orval"
import type { PointsPackageWithUsd } from "../../../fiddl-server/src/lib/types/serverTypes"
import { PayPalButtonsComponent, PayPalNamespace } from "@paypal/paypal-js"
import { applyDiscountUsd, normalizeCode, usdToString, validateDiscountCode, type DiscountValidationStatus } from "lib/discount"
import { catchErr, throwErr, getCookie } from "lib/util"
import umami from "lib/umami"
import { metaPixel } from "lib/metaPixel"

interface PointsPackageRender extends PointsPackageWithUsd {
  bgColor?: string
}

export default defineComponent({
  name: "QuickBuyPointsDialog",
  emits: ["paymentComplete"],
  data() {
    return {
      packages: [] as PointsPackageRender[],
      selectedPkgIndex: null as number | null,
      selectedPkg: null as PointsPackageRender | null,
      // Discount state
      discountInput: "" as string,
      discountChecking: false as boolean,
      discountStatus: null as DiscountValidationStatus | null,
      manualApplyAttempted: false as boolean,
      discountDebounceTimer: null as any,
      // PayPal
      payPal: null as null | PayPalNamespace,
      ppButton: null as null | PayPalButtonsComponent,
      isRenderingPaypal: false as boolean,
      visibilityObserver: null as IntersectionObserver | null,
      // UI
      showPackages: false,
    }
  },
  computed: {
    normalizedDiscount(): string | null {
      return normalizeCode(this.discountInput)
    },
    codeDiscountPct(): number {
      return this.discountStatus && this.discountStatus.ok ? this.discountStatus.discountPct || 0 : 0
    },
    finalUsd(): number {
      const base = Number(this.selectedPkg?.usd || 0)
      return applyDiscountUsd(base, this.codeDiscountPct)
    },
    finalUsdString(): string {
      return usdToString(this.finalUsd)
    },
  },
  watch: {
    discountInput(val: string) {
      this.manualApplyAttempted = false
      if (this.discountDebounceTimer) {
        clearTimeout(this.discountDebounceTimer)
        this.discountDebounceTimer = null
      }
      const code = this.normalizedDiscount
      if (!code) {
        this.discountStatus = null
        try { LocalStorage.remove("discountCode") } catch {}
        return
      }
      if (this.selectedPkgIndex == null) return
      this.discountDebounceTimer = setTimeout(() => {
        this.discountDebounceTimer = null
        void this.autoValidateDiscount()
      }, 500)
    },
    selectedPkg() {
      // Rebuild the PayPal button when package changes to ensure config refresh
      void this.rebuildPaypal()
    },
    showPackages(val: boolean) {
      if (!val) {
        // When returning from package list to summary, ensure button is present
        void this.ensurePaypalRendered()
      }
    },
    discountStatus: {
      deep: true,
      handler() {
        if (this.ppButton) {
          // Avoid unsupported bottom placement which spams console on mobile
          void this.ppButton.updateProps({ message: { amount: this.finalUsd, color: "black" } as any })
        }
      },
    },
  },
  async mounted() {
    // Load packages and select the $17 / 2000 default package
    try {
      const { data } = await pointsPackagesAvailable()
      this.packages = (data || []).map((p: any) => ({ ...p }))
      let idx = this.packages.findIndex((p) => Number(p.points) === 2000)
      if (idx < 0) idx = this.packages.findIndex((p) => Math.abs(Number(p.usd) - 17) < 0.01)
      if (idx < 0) idx = this.packages.length > 0 ? 0 : -1
      if (idx >= 0) this.setSelected(idx)
    } catch {}

    // Restore discount code from LocalStorage if present
    try {
      const stored = LocalStorage.getItem("discountCode")
      if (typeof stored === "string") this.discountInput = stored
    } catch {}
    // Ensure a clean container before first render to avoid duplicates
    this.forceClearPaypalContainer()
    await this.ensurePaypalRendered()
    this.setupVisibilityObserver()
  },
  beforeUnmount() {
    this.teardownPaypal()
    this.cleanupVisibilityObserver()
  },
  methods: {
    forceClearPaypalContainer() {
      try {
        const el = this.$refs.paypal as HTMLDivElement
        if (el) el.innerHTML = ""
      } catch {}
    },
    setupVisibilityObserver() {
      try {
        const el = this.$refs.paypal as HTMLDivElement
        if (!el || this.visibilityObserver) return
        this.visibilityObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.target !== el) continue
            if (entry.isIntersecting) {
              // Ensure rendered when scrolled into view; don't teardown on scroll
              void this.ensurePaypalRendered()
            }
          }
        }, { threshold: [0] })
        this.visibilityObserver.observe(el)
      } catch {}
    },
    cleanupVisibilityObserver() {
      try {
        if (this.visibilityObserver) this.visibilityObserver.disconnect()
        this.visibilityObserver = null
      } catch {}
    },
    pkgCardClass(pkg: PointsPackageRender, index: number) {
      return index === this.selectedPkgIndex ? "active" : ""
    },
    setSelected(index: number) {
      this.selectedPkgIndex = index
      this.selectedPkg = this.packages[index] || null
      void this.ensurePaypalRendered()
      if (this.normalizedDiscount) {
        this.manualApplyAttempted = false
        void this.autoValidateDiscount()
      }
    },
    async autoValidateDiscount() {
      if (!this.normalizedDiscount || this.selectedPkgIndex == null) return
      const token = Date.now()
      try {
        this.discountChecking = true
        const { status } = await validateDiscountCode(this.normalizedDiscount, this.selectedPkgIndex)
        this.discountStatus = status
        if (status.ok) {
          LocalStorage.set("discountCode", status.code)
        }
      } catch {
        // ignore silent auto-validate errors
      } finally {
        this.discountChecking = false
      }
    },
    async applyDiscount() {
      this.manualApplyAttempted = true
      const code = this.normalizedDiscount
      if (!code) {
        this.discountStatus = null
        return
      }
      if (this.selectedPkgIndex == null) {
        Notify.create({ type: "warning", message: "Select a package first" })
        return
      }
      try {
        this.discountChecking = true
        const { status } = await validateDiscountCode(code, this.selectedPkgIndex)
        this.discountStatus = status
        if (status.ok) {
          LocalStorage.set("discountCode", status.code)
          Notify.create({ type: "positive", message: `Applied ${Math.round((status.discountPct || 0) * 100)}% discount` })
        } else {
          Notify.create({ type: "negative", message: status.reason === 'exhausted' ? 'This code has reached maximum uses' : 'Code not found' })
        }
      } catch {
        Notify.create({ type: "negative", message: "Could not validate discount code" })
      } finally {
        this.discountChecking = false
      }
    },
    clearDiscount() {
      this.discountInput = ""
      this.discountStatus = null
      LocalStorage.remove("discountCode")
      this.manualApplyAttempted = false
      if (this.discountDebounceTimer) {
        clearTimeout(this.discountDebounceTimer)
        this.discountDebounceTimer = null
      }
    },
    teardownPaypal() {
      try { (this.ppButton as any)?.close?.() } catch {}
      const el = this.$refs.paypal as HTMLDivElement
      if (el) el.innerHTML = ""
      this.ppButton = null
    },
    async rebuildPaypal() {
      this.teardownPaypal()
      await nextTick()
      await this.ensurePaypalRendered()
    },
    ensurePaypalRendered(attempt = 0) {
      if (!this.selectedPkg) return
      const maxAttempts = 40
      const delayMs = 50
      const container = this.$refs.paypal as HTMLDivElement | undefined
      const visible = !!container && container.offsetParent !== null && container.getBoundingClientRect().width > 0 && container.getBoundingClientRect().height > 0
      if (!container || !visible) {
        if (attempt < maxAttempts) setTimeout(() => this.ensurePaypalRendered(attempt + 1), delayMs)
        return
      }
      void (async () => {
        if (this.isRenderingPaypal) return
        const el = this.$refs.paypal as HTMLDivElement
        if (!this.payPal) this.payPal = await loadPayPal()
        if (!el) return
        // If container already has PayPal DOM but our handle is missing, clear it to avoid duplicates
        if (el.childElementCount > 0 && !this.ppButton) {
          el.innerHTML = ""
        }
        if (el.childElementCount === 0) {
          this.isRenderingPaypal = true
          if (this.ppButton) {
            try { await (this.ppButton as any).close?.() } catch {}
            this.ppButton = null
          }
          this.initPPButton()
          await this.$nextTick()
          const el2 = this.$refs.paypal as HTMLDivElement
          if (el2) await this.ppButton!.render(el2)
          this.isRenderingPaypal = false
        }
        if (this.ppButton && this.selectedPkg) {
          void this.ppButton.updateProps({ message: { amount: this.finalUsd, color: "black" } as any })
        }
      })()
    },
    initPPButton() {
      if (!this.payPal?.Buttons) return
      this.ppButton = this.payPal.Buttons({
        style: { label: "pay" },
        // Avoid bottom-positioned message which can conflict with certain wallets
        message: { amount: 0 } as any,
        createOrder: async () => {
          if (this.selectedPkgIndex == null) throwErr("Failed to create order")
          const discountCode = this.discountStatus && this.discountStatus.ok ? this.discountStatus.code : undefined
          const res = await pointsInitBuyPackage({ method: "payPal", packageId: this.selectedPkgIndex, discountCode }).catch(catchErr)
          if (!res?.data) return ""
          try {
            metaPixel.trackInitiateCheckout({
              currency: "USD",
              value: Number(this.finalUsd || this.selectedPkg?.usd || 0),
              num_items: 1,
              content_type: "product",
              contents: [{ id: `points_${this.selectedPkg?.points || 0}`, quantity: 1, item_price: Number(this.finalUsd || this.selectedPkg?.usd || 0) }],
              content_name: `Fiddl Points ${this.selectedPkg?.points || 0}`,
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
            try {
              metaPixel.trackPurchase({
                currency: "USD",
                value: Number(this.finalUsd || this.selectedPkg?.usd || 0),
                num_items: 1,
                content_type: "product",
                contents: [{ id: `points_${this.selectedPkg?.points || 0}`, quantity: 1, item_price: Number(this.finalUsd || this.selectedPkg?.usd || 0) }],
                content_name: `Fiddl Points ${this.selectedPkg?.points || 0}`,
              })
            } catch {}
            umami.track && umami.track("buyPointsPkgSuccess", { points: this.selectedPkg?.points, paid: this.finalUsd || this.selectedPkg?.usd })
            this.$emit("paymentComplete")
          } catch (error: any) {
            if (error?.response?.data?.details?.[0]?.issue === "INSTRUMENT_DECLINED") return actions.restart()
            const errorDetail = error?.response?.data?.details?.[0] || { description: "Unknown error occurred" }
            Notify.create({ type: "negative", message: errorDetail.description })
            throwErr("Failed to capture order: " + errorDetail.description)
          }
        },
      })
    },
  },
})
</script>
