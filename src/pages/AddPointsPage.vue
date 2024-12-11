<template lang="pug">
q-page.full-height.full-width

  .centered.q-mt-md.q-gutter-md
    .col-auto
      .shimmer
        q-img(src="/fiddlPointsLogo-sm.svg" style="width:200px;")
    .col-auto
      .row.q-ma-md
        h2 Add Fiddl Points
      .row.q-ma-md(v-if="!userAuth.loggedIn")
        h4 Please login to add Fiddl Points
      .row.items-center.q-gutter-md(v-if="userAuth.userData")
        h5 Your Fiddl Points:
        h3 {{ userAuth.userData.availablePoints }}
      .row.q-ma-md
        div
          p Fiddl Points are needed to use Fiddl.art
  .centered.q-mt-md(v-if="userAuth.loggedIn")
    h3 Select Points Package
  .centered.q-gutter-lg.q-pt-sm
    q-card.q-pa-lg.cursor-pointer(v-if="packages.length>0" v-for="(pkg, index) in packages" @click="setAddPoints(index)" :class="pkgCardClass(pkg)" :key="pkg.points")
      .centered.q-pb-md.items-center.q-gutter-sm
        h4 +{{ pkg.points.toLocaleString() }}
        q-img(src="/fiddlPointsLogo-sm.svg" height="50px" width="50px")
      .centered.q-pa-sm(style="border-radius: 15px;" :class="pkg.bgColor")
        h4(v-if="pkg.discountPct > 0") {{ pkg.discountPct * 100 }}% Discount
        h4(v-else) No Discount
      .centered.q-pt-md
        h4 ${{ pkg.usd }}
    div(v-else style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; height:230px;")
      q-spinner(size="150px")
  .centered.q-ma-md(v-if="selectedPkg").q-pt-lg
    h4 Adding {{ selectedPkg.points.toLocaleString() }} Points with a {{ selectedPkg.discountPct * 100 }}% discount will cost ${{ selectedPkg?.usd }}
  div.q-mt-lg(:class="!selectedPkg ? 'faded-out' : ''").q-mb-xl
    .centered.q-gutter-md.q-mb-lg
      q-btn(label="Pay with PayPal" color="primary" @click="paymentMethod = 'paypal'" :disable="!selectedPkg || paymentMethod == 'paypal'" :class="!selectedPkg ? 'faded-out' : ''" size="lg" flat)
      q-btn(label="Pay with Crypto" color="primary" @click="paymentMethod = 'crypto'" :disable="!selectedPkg || paymentMethod == 'crypto'" :class="!selectedPkg ? 'faded-out' : ''" size="lg" flat)
    .centered(v-if="paymentMethod == 'paypal'")
      div(ref="paypal" style="border-radius: 14px; width:400px; max-width:90vw").bg-grey-2.q-pa-md.rounded-box
    .centered(v-if="paymentMethod == 'crypto'")
      CryptoPayment.full-width(style="max-width:400px;" :selectedPackageId="selectedPkgIndex === null?undefined:selectedPkgIndex" @paymentComplete="paymentCompleted")
  .centered
    div(style="max-width:900px;")
      q-card.q-ma-md.q-pa-md
        h6 Fiddl Points
        .row
          .col-auto
            .row.q-gutter-md.items-center
              .col
                q-img(src="/fiddlPointsLogo-sm.svg" style="width:50px;")
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



</template>
<style></style>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { loadPayPal } from "lib/payPal"
import { PayPalButtonsComponent, PayPalNamespace } from "@paypal/paypal-js"
import { catchErr, throwErr } from "lib/util"
import type { PointsPackageWithUsd } from "fiddl-server/src/lib/pointsPackages"
import { Dialog, LocalStorage } from "quasar"
import umami from "lib/umami"
import PointsTransfer from "src/components/PointsTransfer.vue"
import CryptoPayment from "components/CryptoPayment.vue"
interface PointsPackageRender extends PointsPackageWithUsd {
  bgColor: string
}

export default defineComponent({
  components: {
    PointsTransfer,
    CryptoPayment,
  },
  data() {
    return {
      userAuth: useUserAuth(),
      selectedPkg: null as null | PointsPackageRender,
      ppButton: null as null | PayPalButtonsComponent,
      packages: [] as PointsPackageRender[],
      selectedPkgIndex: null as null | number,
      payPal: null as null | PayPalNamespace,
      paymentMethod: null as "paypal" | "crypto" | null,
    }
  },
  computed: {},
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
    },
    "userAuth.loggedIn": {
      immediate: false,
      handler() {
        // this.userAuth.loadUserData()
      },
    },
    paymentMethod(val) {
      LocalStorage.set("orderDetails", { packageId: this.selectedPkgIndex, paymentMethod: this.paymentMethod })
      if (val == "paypal") {
        void this.$nextTick(() => {
          void loadPayPal().then((res) => {
            this.payPal = res
            this.initPPButton()
          })
        })
      }
    },
  },

  async created() {},
  async mounted() {
    await this.$api.points.packagesAvailable.query().then((res: any) => {
      this.packages = res.map((el: any) => {
        return {
          ...el,
          bgColor: el.discountPct > 0 ? "bg-positive" : "",
        }
      })
    })
    if (this.userAuth.loggedIn) {
      void this.userAuth.loadUserData()
      void this.userAuth.loadPointsHistory()
    }
    const orderDetails = LocalStorage.getItem("orderDetails") as { packageId: number; paymentMethod: "paypal" | "crypto" }
    console.log("orderDetails", orderDetails)
    if (orderDetails) {
      this.setAddPoints(orderDetails.packageId)
      this.paymentMethod = orderDetails.paymentMethod
    }
  },
  methods: {
    pkgCardClass(pkg: PointsPackageRender) {
      return {
        "selected-box": this.selectedPkg?.points === pkg.points,
        "faded-out": !this.userAuth.loggedIn,
      }
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
          if (this.selectedPkgIndex === null) throwErr("Failed to create order")
          const res = await this.$api.points.initBuyPackage.mutate({ method: "payPal", packageId: this.selectedPkgIndex }).catch(catchErr)
          if (!res) return ""
          return res.id
        },
        onApprove: async (data, actions) => {
          const res = await this.$api.points.finishBuyPackage.mutate({ method: "payPal", orderId: data.orderID })
          if (!res) throwErr("Failed to capture order")
          const errorDetail = res?.details?.[0]
          if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
            return actions.restart()
          }
          if (errorDetail) {
            console.error(errorDetail)
            Dialog.create({
              title: "Error",
              message: errorDetail.description,
              ok: true,
            })
            umami.track("buyPointsPkgFailure", errorDetail)
            throwErr("Failed to capture order: ", errorDetail)
          }
          this.paymentCompleted()
        },
      })
      const payPalDiv = this.$refs.paypal as HTMLDivElement
      if (!payPalDiv) return
      void this.ppButton.render(payPalDiv)
    },
    setAddPoints(pkgIndex: number) {
      console.log("set add points", pkgIndex)
      this.selectedPkgIndex = pkgIndex
      this.selectedPkg = this.packages[pkgIndex]!
    },
    paymentCompleted() {
      void this.userAuth.loadUserData()
      void this.userAuth.loadPointsHistory()
      this.paymentMethod = null
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
  },
})
</script>
