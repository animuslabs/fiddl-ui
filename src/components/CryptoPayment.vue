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
import { pointsFinishBuyPackage, pointsInitBuyPackage } from "src/lib/orval"
import { CryptoOrder } from "lib/prisma"
type CryptoMethod = "telosNative" | "telosEVM"
import { copyToClipboard, LocalStorage, Notify } from "quasar"
let interval: ReturnType<typeof setInterval> | null = null
import ms from "ms"
export default defineComponent({
  name: "CryptoPayment",
  props: {
    selectedPackageId: {
      type: Number as PropType<number | undefined>,
      required: false,
    },
  },
  emits: ["paymentComplete"],
  data() {
    return {
      loading: false,
      selectedMethod: null as null | CryptoMethod,
      cryptoOrder: null as null | CryptoOrder,
    }
  },
  onUnmounted() {
    if (interval) clearInterval(interval)
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
        const response = await pointsFinishBuyPackage({ 
          method: this.selectedMethod, 
          orderId: this.cryptoOrder?.id 
        })
        if (response?.data) {
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
        })
        const order = response?.data as unknown as CryptoOrder
        if (order) {
          LocalStorage.set("cryptoOrder", order)
          this.cryptoOrder = order
        }
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
