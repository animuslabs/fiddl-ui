<template lang="pug">
div
  q-card.q-pa-md.relative-position(style="min-height:400px;")
    h4 Crypto Payment
    q-separator
    .absolute-center(v-if="loading")
      q-spinner(size="100px;")
    div(v-if="!loading")
      div(v-if="selectedMethod == 'telosEVM'").q-ma-md
        p Send TLOS to the following address
        .row.q-gutter-md.no-wrap.full-width
          h3(style="overflow: auto;") {{ cryptoOrder?.destWallet }}
          .col-grow
          q-btn(icon="content_copy" @click="copyAddress" )
        p Quantity
        .row.q-gutter-md.full-width.no-wrap
          h3 {{ cryptoOrder?.tokenAmount }}
          .col-grow
          q-btn(icon="content_copy" @click="copyAmount" )
      div(v-else-if="selectedMethod == 'telosNative'").q-ma-md
        p Send TLOS to the following address
        .row.q-gutter-md
          h3.ellipsis {{ cryptoOrder?.destWallet }}
          q-btn(icon="content_copy" @click="copyAddress" )
        p Quantity
        .row.q-gutter-md
          h3 {{ cryptoOrder?.tokenAmount }}
          q-btn(icon="content_copy" @click="copyAmount" )
        p use the following memo
        .row.q-gutter-md
          h3 {{ cryptoOrder?.memo }}
          q-btn(icon="content_copy" @click="copyMemo" )
      div(v-else).q-mt-md
        .centered
          p Select Payment Method
      div(v-if="selectedMethod == null").q-ma-md
        .centered.q-gutter-md(v-if="selectedPackageId !== null" )
          q-btn(label="Telos EVM" @click="initBuy(selectedPackageId || 0, 'telosEVM')" )
          q-btn(label="Telos native" @click="initBuy(selectedPackageId || 0, 'telosNative')" )
        .centered.q-mt-lg
          a(href="/blog/guides/telos")
            h4 What is Telos?
      div(v-if="cryptoOrder")
        div
          .centered
            q-spinner(size="50px")
          .centered.q-mt-md
            p Awaiting deposit

        div.q-mt-md
          q-btn(label="cancel" @click="cancelOrder" color="accent")
    .centered
      h6 Crypto payments include a 20% fee


</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { pointsFinishBuyPackage, pointsInitBuyPackage, pointsPackagesAvailable } from "src/lib/orval"
import { CryptoOrder } from "lib/prisma"
type CryptoMethod = "telosNative" | "telosEVM"
import { copyToClipboard, LocalStorage, Notify } from "quasar"
let interval: ReturnType<typeof setInterval> | null = null
import ms from "ms"
import { events } from "lib/eventsManager"
import { getTikTokAttribution } from "lib/tiktokAttribution"
import { getMetaAttribution, generateEventId } from "lib/metaAttribution"
import { getCookie } from "lib/util"
export default defineComponent({
  name: "CryptoPayment",
  props: {
    selectedPackageId: {
      type: Number as PropType<number | undefined>,
      required: false,
    },
    discountCode: {
      type: String as PropType<string | undefined>,
      required: false,
    },
  },
  emits: ["paymentComplete"],
  data() {
    return {
      loading: false,
      selectedMethod: null as null | CryptoMethod,
      cryptoOrder: null as null | CryptoOrder,
      purchaseUsd: null as number | null,
      purchasePoints: null as number | null,
    }
  },
  watch: {
    selectedMethod() {
      if (interval) clearInterval(interval)
    },
    selectedPackageId(val: number | undefined) {
      if (!this.selectedMethod) return
      if (val != undefined) void this.initBuy(val, this.selectedMethod)
    },
  },
  beforeUnmount() {
    if (interval) clearInterval(interval)
  },
  mounted() {
    const existingOrder = LocalStorage.getItem("cryptoOrder") as CryptoOrder
    if (existingOrder) {
      if (new Date(existingOrder.createdAt).getTime() + ms("1h") < Date.now()) {
        LocalStorage.remove("cryptoOrder")
        return
      }
      if (existingOrder.chainName == "telosEVM") this.selectedMethod = "telosEVM"
      else if (existingOrder.chainName == "telosNative") this.selectedMethod = "telosNative"
      this.cryptoOrder = existingOrder
      // interval = setInterval(this.finishOrder, 1000)
      setTimeout(() => {
        interval = setInterval(this.finishOrder, 5000)
      }, ms("1s"))
      void this.finishOrder()
      console.log("existingOrder", existingOrder)
    }
  },
  methods: {
    cancelOrder() {
      this.cryptoOrder = null
      this.selectedMethod = null
      LocalStorage.remove("cryptoOrder")
    },
    async finishOrder() {
      console.log("startFinishOrder", this.cryptoOrder, this.selectedMethod)
      if (!this.cryptoOrder || !this.selectedMethod) return
      try {
        const { ttclid, ttp, userAgent } = getTikTokAttribution()
        const { fbp, fbc, eventSourceUrl } = getMetaAttribution()
        const datafastVisitorId = getCookie("datafast_visitor_id")
        const response = await pointsFinishBuyPackage({
          method: this.selectedMethod,
          orderId: this.cryptoOrder?.id,
          trackingId: datafastVisitorId || undefined,
          ttclid,
          ttp,
          userAgent,
          fbp,
          fbc,
          eventSourceUrl,
        })
        if (response?.data) {
          try {
            if (this.purchaseUsd != null) {
              events.purchaseCompleted({
                method: "crypto",
                currency: "USD",
                value: Number(this.purchaseUsd),
                num_items: 1,
                content_type: "product",
                contents: [{ id: `points_${this.purchasePoints || 0}`, quantity: 1, item_price: Number(this.purchaseUsd) }],
                content_name: this.purchasePoints != null ? `Fiddl Points ${this.purchasePoints}` : "Fiddl Points Package",
                points: this.purchasePoints ?? null,
                transaction_id: this.cryptoOrder?.id,
              } as any)
            }
          } catch {}
          this.$emit("paymentComplete")
          console.log(response.data)
        }
      } catch (err: any) {
        console.log(err.message)
        if (err.message.includes("Order already confirmed")) {
          LocalStorage.remove("cryptoOrder")
          this.$emit("paymentComplete")
        }
      }
    },
    async initBuy(packageId: number, method: CryptoMethod) {
      this.loading = true
      this.selectedMethod = method
      try {
        const response = await pointsInitBuyPackage({
          method,
          packageId,
          discountCode: this.discountCode || undefined,
        })
        const order = response?.data as unknown as CryptoOrder
        if (order) {
          LocalStorage.set("cryptoOrder", order)
          this.cryptoOrder = order
        }

        // Load package info to attribute value/points
        try {
          const { data: pkgs } = await pointsPackagesAvailable()
          if (Array.isArray(pkgs)) {
            const pkg = pkgs?.[packageId] as any
            if (pkg) {
              this.purchaseUsd = Number(pkg.usd)
              this.purchasePoints = Number(pkg.points)
            }
          }
        } catch {}

        // Track checkout initiation for crypto
        try {
          const event_id = generateEventId()
          events.purchaseInitiated({
            method: "crypto",
            currency: this.purchaseUsd != null ? "USD" : undefined,
            value: this.purchaseUsd != null ? Number(this.purchaseUsd) : undefined,
            num_items: 1,
            content_type: "product",
            contents: [{ id: this.purchasePoints != null ? `points_${this.purchasePoints}` : "points_pkg", quantity: 1, item_price: this.purchaseUsd != null ? Number(this.purchaseUsd) : undefined }],
            content_name: this.purchasePoints != null ? `Fiddl Points ${this.purchasePoints}` : "Fiddl Points Package (crypto)",
            points: this.purchasePoints ?? null,
            event_id,
          } as any)
        } catch {}
      } catch (error) {
        console.error("Failed to initialize package purchase:", error)
      }
      setTimeout(() => {
        interval = setInterval(this.finishOrder, 5000)
      }, ms("1s"))
      this.loading = false
    },
    copyAmount() {
      if (!this.cryptoOrder) return
      void navigator.clipboard.writeText(this.cryptoOrder.tokenAmount.toString())
      Notify.create({
        message: "Amount copied to clipboard",
        color: "positive",
      })
    },
    copyAddress() {
      if (!this.cryptoOrder) return
      void navigator.clipboard.writeText(this.cryptoOrder.destWallet)
      Notify.create({
        message: "Address copied to clipboard",
        color: "positive",
      })
    },
    copyMemo() {
      if (!this.cryptoOrder || !this.cryptoOrder.memo) return
      void navigator.clipboard.writeText(this.cryptoOrder.memo)
      Notify.create({
        message: "Memo copied to clipboard",
        color: "positive",
      })
    },
  },
})
</script>
