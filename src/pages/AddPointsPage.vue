<template lang="pug">
q-page.full-height.full-width

  // Hero / Value proposition
  .hero-section.q-pt-lg.q-pb-md
    .column.items-center.q-gutter-xs
      .shimmer
        q-img(src="/FiddlPointsLogo-sm.svg" style="width:140px;")
      h2.text-weight-bold.text-white Fiddl Points
      h4.text-white {{ (userAuth.userData?.availablePoints || 0).toLocaleString() }} Available
      p.text-white.text-subtitle2.q-ma-md Fiddl Points power images, videos and model training across Fiddl.art
      //- q-btn(outline color="white" label="View history" icon="receipt_long" @click="mainTab = 'history'" v-if="userAuth.loggedIn")

  // Main content container
  .q-mx-auto.q-px-md(style="max-width: 1100px;")

    // High-level tabs
    q-tabs(v-model="mainTab" class="bg-dark text-white rounded-tabs shadow-1 q-mt-md q-mb-md" no-caps)
      q-tab(name="buy" label="Buy Points" icon="shopping_cart")
      q-tab(name="history" label="History" icon="receipt_long" :disable="!userAuth.loggedIn")

    q-tab-panels(v-model="mainTab")
      q-tab-panel(name="buy")
        .row.items-center.justify-between.q-mb-sm
          h4.q-my-none Select Points Package
          .row.items-center.q-gutter-sm
            q-btn-toggle(v-model="buyMode" spread dense toggle-color="primary" color="dark" text-color="white" no-caps :options="[{label: 'In-App (PayPal/Crypto)', value: 'app'},{label: 'Telegram Stars', value: 'telegram'}]")

        // In-app packages grid
        div(v-if="buyMode === 'app' && packages.length > 0" class="packages-grid")
          q-card.q-pa-md.pkg-card.cursor-pointer(v-for="(pkg, index) in packages" :key="pkg.points" @click="setAddPoints(index)" :class="pkgCardClass(pkg)" v-show="!(isMobile && selectedPkg && selectedPkgIndex !== index)")
            .row.items-center.justify-between
              h4.q-my-none +{{ pkg.points.toLocaleString() }}
              q-img(src="/FiddlPointsLogo-sm.svg" height="42px" width="42px")
            .row.q-mt-sm.items-center.q-gutter-xs
              q-badge(:color="pkg.discountPct > 0 ? 'positive' : 'dark'" :text-color="pkg.discountPct > 0 ? 'white' : 'white'" :label="pkg.discountPct > 0 ? (pkg.discountPct * 100 + '% OFF') : 'Standard'")
              q-badge(v-if="index === bestValueIndex" color="positive" text-color="white" label="Best value" class="q-ml-xs")
            .row.items-center.justify-between.q-mt-md
              h5.q-my-none ${{ pkg.usd }}
              //- q-btn(flat color="primary" label="Select" size="sm")
        // Telegram Stars content
        div(v-else-if="buyMode === 'telegram'" class="q-mt-md")
          .row.items-center.q-gutter-sm
            h6 Telegram Stars
            q-badge(v-if="tgStatusChecked" :color="tgLinked ? 'positive' : 'warning'") {{ tgLinked ? (tgTelegramName ? `Connected as ${tgTelegramName}` : 'Connected') : 'Not Connected' }}
          div(v-if="!tgLinked" class="q-mt-sm")
            p Connect your account to buy Fiddl Points with Telegram Stars.
            .row.q-gutter-sm.items-center
              q-btn(@click="startTgDeepLink()" color="primary" icon="fa-brands fa-telegram" :loading="tgLinking" :disable="tgLinking" label="Connect Telegram")
              q-btn(v-if="deepLink?.deepLink" type="a" :href="deepLink?.deepLink" target="_blank" flat label="Open Telegram")
            div(v-if="tgLinking" class="q-mt-sm")
              q-linear-progress(:value="countdownPct" color="primary" track-color="grey-4")
              small Expires in {{ countdownText }}
          div(v-else)
            div(v-if="tgPackages.length > 0" class="packages-grid")
              q-card.q-pa-md.pkg-card.cursor-pointer(v-for="pkg in tgPackages" :key="pkg.id" @click="buyWithStars(pkg.id)")
                .row.items-center.justify-between
                  h4.q-my-none +{{ pkg.points.toLocaleString() }}
                  div.text-subtitle1 {{ pkg.stars }} ⭐
                .row.q-mt-sm.items-center.q-gutter-xs
                  q-badge(:color="pkg.discountPct > 0 ? 'positive' : 'dark'" :text-color="pkg.discountPct > 0 ? 'white' : 'white'" :label="pkg.discountPct > 0 ? (pkg.discountPct * 100 + '% OFF') : 'Standard'")
            div(v-else style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; height:230px;")
              q-spinner(size="100px")

        // Loading for in-app packages
        div(v-else style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; height:230px;")
          q-spinner(size="150px")

        // Selected package summary and actions (in-app only)
        q-slide-transition
          div(v-show="buyMode === 'app' && selectedPkg" class="q-mt-lg")

            q-banner(rounded class="bg-dark text-white q-pa-md")
              template(#avatar)
                q-icon(name="local_offer" color="white")
              div
                b Adding {{ selectedPkg?.points?.toLocaleString() }} points
                span  with a {{ ((selectedPkg?.discountPct || 0) * 100) }}% discount for
                b  ${{ selectedPkg?.usd }}
            .centered.q-my-sm.full-width
              q-btn( outline color="primary" icon="refresh" label="Select Different Package" @click="selectedPkg = null")
            .row
              .col-xs-12.col-md-6
                q-card.bg-transparent.scroll-anchor(ref="paymentSection" id="payment-section")
                  q-tabs(v-model="paymentMethod" class="text-white bg-dark" no-caps dense)
                    q-tab(name="paypal" icon="payments" label="PayPal")
                    q-tab(name="crypto" icon="currency_bitcoin" label="Crypto")
                  q-separator
                  q-tab-panels(v-model="paymentMethod" style="min-height: 100px;")
                    q-tab-panel(name="paypal")
                      .centered
                        div.bg-white(ref="paypal" class="paypal-container q-pa-md rounded-box bg-dark")
                    q-tab-panel(name="crypto")
                      .centered
                        CryptoPayment.full-width(style="max-width:420px;" :selectedPackageId="selectedPkgIndex" @paymentComplete="paymentCompleted")
              .col-xs-12.col-md-6
                // Suggestions for selected package amount
                q-card.q-mt-md.q-ma-sm
                  q-card-section
                    h6.q-my-none What you can do with {{ selectedPkg?.points.toLocaleString() }} points
                    q-list(dense)
                      q-item(v-for="(s, i) in pkgSuggestionsSelected" :key="'sel-' + i")
                        q-item-section(avatar)
                          q-icon(:name="s.icon" color="primary")
                        q-item-section {{ s.text }}

      // HISTORY TAB
      q-tab-panel(name="history")
        .centered
          div(style="max-width:900px; width: 100%;")
            q-card.q-pa-md
              h6 Fiddl Points
              .row
                .col-auto
                  .row.q-gutter-md.items-center
                    .col
                      q-img(src="/FiddlPointsLogo-sm.svg" style="width:50px;")
                    .col-auto
                      .centered
                        h5 {{ $userAuth.userData?.availablePoints || 0 }}
                      .centered
                        h6 Available
                    .col-auto
                      .centered
                        h5 {{ $userAuth.userData?.spentPoints || 0 }}
                      .centered
                        h6 Spent
              q-separator.q-mt-md(color="primary")
              q-list
                PointsTransfer.q-pt-md(v-for="transfer of userAuth.pointsHistory" :transferData="transfer" :key="transfer.id")
                .centered(v-if="userAuth.pointsHistory.length == 0")
                  h6 No history yet
</template>

<style lang="sass" scoped>
.hero-section
  background-color: var(--q-dark)
  color: white
  text-align: center
  .shimmer
    filter: drop-shadow(0 4px 18px rgba(0,0,0,.18))

.rounded-tabs
  border-radius: 12px

.packages-grid
  display: grid
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))
  gap: 16px
  align-items: stretch
  grid-auto-rows: 1fr

.pkg-card
  transition: transform .15s ease, box-shadow .15s ease
  height: 100%
  display: flex
  flex-direction: column
  &:hover
    transform: translateY(-2px)

.pkg-card .row.items-center.justify-between.q-mt-md
  margin-top: auto

.paypal-container
  border-radius: 14px
  width: 100%
  max-width: 420px

.scroll-anchor
  scroll-margin-top: 72px
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { pointsPackagesAvailable, pointsInitBuyPackage, pointsFinishBuyPackage, userGet } from "src/lib/orval"
import { telegramPackages as tgPackagesApi, telegramLinkStatus, telegramCreateDeepLink, telegramCreateBuyDeepLink, type TelegramPackages200Item, type TelegramCreateDeepLink200 } from "src/lib/orval"
import { useUserAuth } from "stores/userAuth"
import { loadPayPal } from "lib/payPal"
import { PayPalButtonsComponent, PayPalNamespace } from "@paypal/paypal-js"
import { catchErr, throwErr, getCookie } from "lib/util"
import type { PointsPackageWithUsd } from "../../../fiddl-server/src/lib/types/serverTypes"
import { Dialog, LocalStorage } from "quasar"
import umami from "lib/umami"
import PointsTransfer from "src/components/PointsTransfer.vue"
import CryptoPayment from "components/CryptoPayment.vue"
import { usePricesStore } from "stores/pricesStore"

interface PointsPackageRender extends PointsPackageWithUsd {
  bgColor: string
}

interface SuggestionItem {
  icon: string
  text: string
}

export default defineComponent({
  components: {
    PointsTransfer,
    CryptoPayment,
  },
  data() {
    return {
      userAuth: useUserAuth(),
      pricesStore: usePricesStore(),
      selectedPkg: null as null | PointsPackageRender,
      ppButton: null as null | PayPalButtonsComponent,
      packages: [] as PointsPackageRender[],
      selectedPkgIndex: undefined as number | undefined,
      payPal: null as null | PayPalNamespace,
      paymentMethod: "paypal" as "paypal" | "crypto" | null,
      buyMode: "app" as "app" | "telegram",
      isRenderingPaypal: false,
      mainTab: "buy" as "buy" | "history",
      isMobile: typeof window !== "undefined" ? window.innerWidth <= 768 : false,
      // Telegram state
      tgLinked: false,
      tgStatusChecked: false,
      tgTelegramId: null as string | null,
      tgTelegramName: null as string | null,
      tgLinking: false,
      deepLink: null as TelegramCreateDeepLink200 | null,
      countdown: 0,
      countdownTotal: 0,
      countdownTimer: null as any,
      tgPollTimer: null as any,
      tgPackages: [] as TelegramPackages200Item[],
    }
  },
  computed: {
    countdownPct(): number {
      if (!this.countdownTotal) return 0
      return Math.max(0, Math.min(1, this.countdown / this.countdownTotal))
    },
    countdownText(): string {
      const s = Math.max(0, this.countdown | 0)
      const m = Math.floor(s / 60)
      const sec = s % 60
      return `${m}:${sec.toString().padStart(2, "0")}`
    },
    bestValueIndex(): number | null {
      if (!this.packages.length) return null
      let best = 0
      let bestDisc = this.packages[0]?.discountPct || 0
      for (let i = 1; i < this.packages.length; i++) {
        const d = this.packages[i]?.discountPct || 0
        if (d > bestDisc || (d === bestDisc && (this.packages[i]?.points || 0) > (this.packages[best]?.points || 0))) {
          best = i
          bestDisc = d
        }
      }
      return best
    },
    totalAfterPurchase(): number {
      const base = this.userAuth.userData?.availablePoints || 0
      return base + (this.selectedPkg?.points || 0)
    },
    pkgSuggestionsSelected(): SuggestionItem[] {
      const points = this.selectedPkg?.points || 0
      return this.suggestionsForPoints(points)
    },
    pkgSuggestionsTotal(): SuggestionItem[] {
      const points = this.totalAfterPurchase
      return this.suggestionsForPoints(points)
    },
  },
  watch: {
    selectedPkg() {
      if (!this.selectedPkg) return
      LocalStorage.set("orderDetails", { packageId: this.selectedPkgIndex, paymentMethod: this.paymentMethod })
      console.log("selected pkg", this.selectedPkg)
      const fundingEligibility = this.payPal?.getFundingSources ? this.payPal?.getFundingSources() : null
      console.log(fundingEligibility)
      void this.ppButton?.updateProps({
        message: {
          amount: this.selectedPkg.usd,
          color: "black",
          position: "bottom",
        },
      })
      this.ensurePaypalRendered()
      void this.$nextTick(() => this.scrollToPayment())
    },
    "userAuth.loggedIn": {
      immediate: false,
      handler() {
        // this.userAuth.loadUserData()
      },
    },
    paymentMethod: {
      handler(val) {
        LocalStorage.set("orderDetails", { packageId: this.selectedPkgIndex, paymentMethod: this.paymentMethod })
        if (val == "paypal") {
          this.ensurePaypalRendered()
        } else if (val == "crypto") {
          this.teardownPaypal()
        }
      },
      immediate: true,
    },
    buyMode(val) {
      if (val === "app") return
      // Prepare telegram data when user switches
      void this.checkTgStatus()
      void this.loadTgPackages()
    },
    mainTab(val: string) {
      if (val === "buy" && this.paymentMethod === "paypal" && this.selectedPkg) {
        this.ensurePaypalRendered()
      }
    },
  },

  async created() {},
  async mounted() {
    if (typeof window !== "undefined") window.addEventListener("resize", this.updateIsMobile)
    this.updateIsMobile()
    const packagesResponse = await pointsPackagesAvailable()
    if (packagesResponse?.data) {
      this.packages = packagesResponse.data.map((el: any) => {
        return {
          ...el,
          bgColor: el.discountPct > 0 ? "bg-positive" : "",
        }
      })
    }
    if (this.userAuth.loggedIn) {
      void this.userAuth.loadUserData()
      void this.userAuth.loadPointsHistory()
    }
    // Prefetch telegram status/packages quietly
    void this.checkTgStatus()
    void this.loadTgPackages()
    void this.pricesStore.reloadPrices()
    const orderDetails = LocalStorage.getItem("orderDetails") as { packageId: number; paymentMethod: "paypal" | "crypto" }
    console.log("orderDetails", orderDetails)
    if (orderDetails) {
      this.setAddPoints(orderDetails.packageId)
      this.paymentMethod = orderDetails.paymentMethod
      if (orderDetails.paymentMethod === "paypal") {
        void this.$nextTick(() => this.ensurePaypalRendered())
      }
    }
  },
  beforeUnmount() {
    if (typeof window !== "undefined") window.removeEventListener("resize", this.updateIsMobile)
    if (this.countdownTimer) clearInterval(this.countdownTimer)
    if (this.tgPollTimer) clearInterval(this.tgPollTimer)
  },
  methods: {
    async checkTgStatus() {
      try {
        const { data } = await telegramLinkStatus()
        this.tgLinked = Boolean(data.linked)
        const extra = (data?.data || null) as any
        this.tgTelegramId = extra && typeof extra === "object" && "telegramId" in extra ? String(extra.telegramId) : null
        this.tgTelegramName = extra && typeof extra === "object" && "telegramName" in extra ? String(extra.telegramName) : null
        if (!this.tgLinked && this.tgTelegramId) this.tgLinked = true
      } catch {
        // ignore
      } finally {
        this.tgStatusChecked = true
      }
    },
    async startTgDeepLink() {
      if (this.tgLinking) return
      this.tgLinking = true
      try {
        const { data } = await telegramCreateDeepLink({})
        this.deepLink = data
        this.countdownTotal = data.expiresIn
        this.countdown = data.expiresIn
        this.startCountdown()
        if (data.deepLink) {
          try {
            window.open(data.deepLink, "_blank")
          } catch {}
        }
        this.startPolling()
      } catch (e) {
        this.tgLinking = false
        catchErr(e)
      }
    },
    startCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer)
      this.countdownTimer = setInterval(() => {
        this.countdown = Math.max(0, this.countdown - 1)
        if (this.countdown <= 0) {
          clearInterval(this.countdownTimer)
          this.tgLinking = false
        }
      }, 1000)
    },
    startPolling() {
      if (this.tgPollTimer) clearInterval(this.tgPollTimer)
      this.tgPollTimer = setInterval(async () => {
        try {
          const { data } = await telegramLinkStatus()
          if (data.linked || (data?.data as any)?.telegramId) {
            if (this.tgPollTimer) clearInterval(this.tgPollTimer)
            this.tgPollTimer = null
            if (this.countdownTimer) clearInterval(this.countdownTimer)
            this.tgLinking = false
            this.tgLinked = true
            const extra = data?.data as any
            this.tgTelegramId = extra?.telegramId || null
            this.tgTelegramName = extra?.telegramName || null
          }
        } catch {}
        if (this.countdown <= 0) {
          if (this.tgPollTimer) clearInterval(this.tgPollTimer)
          this.tgPollTimer = null
        }
      }, 2000)
    },
    async loadTgPackages() {
      try {
        const { data } = await tgPackagesApi()
        this.tgPackages = data
      } catch {
        this.tgPackages = []
      }
    },
    async buyWithStars(packageId: number) {
      try {
        const { data } = await telegramCreateBuyDeepLink({ packageId })
        if (data.deepLink) window.open(data.deepLink, "_blank")
      } catch (e) {
        catchErr(e)
      }
    },
    updateIsMobile() {
      this.isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : this.isMobile
    },
    pkgCardClass(pkg: PointsPackageRender) {
      return {
        "selected-box": this.selectedPkg?.points === pkg.points,
        "faded-out": !this.userAuth.loggedIn,
      }
    },
    teardownPaypal() {
      try {
        // @ts-ignore - close may not exist on Buttons type
        const closeFn = this.ppButton && (this.ppButton as any).close
        if (typeof closeFn === "function") {
          void closeFn.call(this.ppButton)
        }
      } catch (e) {
        console.warn("paypal close error", e)
      }
      const el = this.$refs.paypal as HTMLDivElement
      if (el) {
        el.innerHTML = ""
      }
      this.ppButton = null
    },
    scrollToPayment() {
      const isSmall = typeof window !== "undefined" ? window.innerWidth <= 768 : false
      if (!isSmall) return

      const el = document.getElementById("payment-section") || (this.$refs.paymentSection as HTMLElement) || (this.$refs.paypal as HTMLElement)
      if (!el) return

      // Use native smooth scrolling to the #payment-section anchor
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })
      } catch {
        // Fallback for older browsers
        const y = (el as any).offsetTop || 0
        if (typeof window !== "undefined") window.scrollTo({ top: Math.max(y - 72, 0), behavior: "smooth" })
      }
    },
    ensurePaypalRendered(attempt = 0) {
      if (this.paymentMethod !== "paypal" || !this.selectedPkg) return

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

      void (async () => {
        const el = this.$refs.paypal as HTMLDivElement
        if (!this.payPal) {
          this.payPal = await loadPayPal()
        }
        if (!el) return
        if (el.childElementCount === 0) {
          if (this.ppButton) {
            try {
              // @ts-ignore
              await (this.ppButton as any).close?.()
            } catch {}
            this.ppButton = null
          }
          this.initPPButton()
          await this.$nextTick()
          const el2 = this.$refs.paypal as HTMLDivElement
          if (el2) {
            await this.ppButton!.render(el2)
          }
        }
        if (this.ppButton && this.selectedPkg) {
          void this.ppButton.updateProps({
            message: {
              amount: this.selectedPkg.usd,
              color: "black",
              position: "bottom",
            },
          })
        }
        // after PayPal is ready, ensure we scroll into view on mobile
        this.scrollToPayment()
      })()
    },
    initPPButton() {
      if (!this.payPal?.Buttons) return
      this.ppButton = this.payPal.Buttons({
        style: {
          label: "pay",
        },
        message: {
          amount: 0,
          position: "bottom",
        },
        createOrder: async () => {
          if (this.selectedPkgIndex == null) throwErr("Failed to create order")
          const res = await pointsInitBuyPackage({ method: "payPal", packageId: this.selectedPkgIndex }).catch(catchErr)
          if (!res?.data) return ""
          if (!res) return ""
          return res.data.id
        },
        onApprove: async (data, actions) => {
          try {
            const datafastVisitorId = getCookie("datafast_visitor_id")

            const res = await pointsFinishBuyPackage({ method: "payPal", orderId: data.orderID, trackingId: datafastVisitorId || undefined })
            if (!res?.data) {
              throwErr("Failed to capture order")
              return
            }

            // Handle success case
            void this.userAuth.loadUserData()
            void this.userAuth.loadPointsHistory()
            // Dialog.create({
            //   title: "Success",
            //   message: "Thank you for your purchase!",
            //   ok: true,
            //   color: "positive",
            // })
            this.paymentCompleted()
          } catch (error: any) {
            // Check for declined instrument in error response
            if (error?.response?.data?.details?.[0]?.issue === "INSTRUMENT_DECLINED") {
              return actions.restart()
            }

            const errorDetail = error?.response?.data?.details?.[0] || { description: "Unknown error occurred" }
            console.error(errorDetail)
            Dialog.create({
              title: "Error",
              message: errorDetail.description,
              ok: true,
            })
            // @ts-ignore
            if (typeof umami !== "undefined") {
              // @ts-ignore
              umami.track("buyPointsPkgFailure", errorDetail)
            }
            throwErr("Failed to capture order: " + errorDetail.description)
          }
        },
      })
      // Rendering is handled by ensurePaypalRendered to avoid race conditions
    },
    setAddPoints(pkgIndex: number) {
      console.log("set add points", pkgIndex)
      this.selectedPkgIndex = pkgIndex
      this.selectedPkg = this.packages[pkgIndex]!
      this.mainTab = "buy"
    },
    paymentCompleted() {
      void this.userAuth.loadUserData()
      void this.userAuth.loadPointsHistory()
      umami.track("buyPointsPkgSuccess", { points: this.selectedPkg?.points, paid: this.selectedPkg?.usd })
      LocalStorage.remove("orderDetails")
      this.selectedPkg = null
      Dialog.create({
        title: "Success",
        message: "Points added successfully",

        ok: true,
        color: "positive",
      })
    },
    suggestionsForPoints(points: number): SuggestionItem[] {
      const p = this.pricesStore.prices
      const out: SuggestionItem[] = []
      if (!points || !p) return out

      // Keep this section short and clear. Show 4-5 high-impact items.

      // 1) Images (Flux Dev as baseline)
      const fluxDev = p.image?.model?.["flux-dev"]
      if (fluxDev) {
        const n = Math.floor(points / fluxDev)
        if (n >= 1) out.push({ icon: "photo", text: `~${n} images (Flux Dev)` })
      }

      // 2) Short videos (Seedance Lite)
      const seedanceLite = p.video?.model?.["seedance-lite"]
      if (seedanceLite) {
        const n = Math.floor(points / seedanceLite)
        if (n >= 1) out.push({ icon: "movie", text: `~${n} short videos` })
      }

      // 4) Train custom models — accurate counts using trainModelPrice formula:
      //    price = prices.forge.trainBaseModel[base] + prices.forge.fineTuneType[type]
      const base = p.forge?.trainBaseModel
      const tune = p.forge?.fineTuneType
      if (base && tune) {
        const devLoraPrice = (base.fluxDev || 0) + (tune.lora || 0)
        if (devLoraPrice > 0) {
          const nDev = Math.floor(points / devLoraPrice)
          if (nDev >= 1) out.push({ icon: "model_training", text: `~${nDev} custom model${nDev > 1 ? "s" : ""} (Flux Dev + LoRA)` })
        }
        // Show advanced option only when user likely has enough points; omit else to keep list short
        const proFullPrice = (base.fluxPro || 0) + (tune.full || 0)
        if (proFullPrice > 0) {
          const nPro = Math.floor(points / proFullPrice)
          if (nPro >= 1) out.push({ icon: "auto_graph", text: `~${nPro} advanced model${nPro > 1 ? "s" : ""} (Flux Pro + Full)` })
        }
      }

      // 5) Unlock premium images
      const unlock = p.image?.unlock
      if (unlock) {
        const n = Math.floor(points / unlock)
        if (n >= 1) out.push({ icon: "lock_open", text: `Unlock ~${n} premium images` })
      }

      // Keep it concise
      return out.slice(0, 5)
    },
  },
})
</script>
