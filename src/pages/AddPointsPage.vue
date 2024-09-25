<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Add Fiddl Points
  .centered.q-ma-md(v-if="!userAuth.loggedIn")
    h4 Please login to add Fiddl Points
  .centered.items-center.q-gutter-md(v-if="userAuth.userData")
    h5 Your Fiddl Points:
    h3 {{ userAuth.userData.availablePoints }}
  .centered
    h5 Fiddl Points are needed to use Fiddl.art
  .centered.q-mt-md(v-if="userAuth.loggedIn")
    h3 Select Points Package
  .centered.q-gutter-lg.q-pt-sm
    q-card.q-pa-lg.cursor-pointer(v-if="packages.length>0" v-for="(pkg, index) in packages" @click="setAddPoints(index)" :class="pkgCardClass(pkg)" :key="pkg.points")
      .centered.q-pb-md.items-center.q-gutter-sm
        h4 +{{ pkg.points.toLocaleString() }}
        q-img(src="/fiddlPointsLogo.svg" height="50px" width="50px")
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
    .centered
      div(ref="paypal" style="border-radius: 14px; width:400px; max-width:90vw").bg-grey-2.q-pa-md.rounded-box



</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { loadPayPal } from "lib/payPal"
import { PayPalButtonsComponent, PayPalNamespace } from "@paypal/paypal-js"
import { throwErr } from "lib/util"
import type { PointsPackageWithUsd } from "../../../fiddl-server/src/lib/pointsPackages"
import { Dialog } from "quasar"
interface PointsPackageRender extends PointsPackageWithUsd {
  bgColor: string
}

export default defineComponent({
  components: {},
  data() {
    return {
      userAuth: useUserAuth(),
      selectedPkg: null as null | PointsPackageRender,
      ppButton: null as null | PayPalButtonsComponent,
      packages: [] as PointsPackageRender[],
      selectedPkgIndex: null as null | number,
      payPal: null as null | PayPalNamespace,
    }
  },
  computed: {},
  watch: {
    selectedPkg() {
      if (!this.selectedPkg) return
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
  },
  async created() {},
  mounted() {
    void loadPayPal().then((res) => {
      this.payPal = res
      this.initPPButton()
    })
    void this.$api.points.packagesAvailble.query().then((res) => {
      this.packages = res.map((el) => {
        return {
          ...el,
          bgColor: el.discountPct > 0 ? "bg-positive" : "",
        }
      })
    })
    if (this.userAuth.loggedIn) void this.userAuth.loadUserData()
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
          const res = await this.$api.points.initBuyPackage.mutate({ method: "payPal", packageId: this.selectedPkgIndex })
          if (!res) throwErr("Failed to create order")
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
            throwErr("Failed to capture order: ", errorDetail)
          }
          void this.userAuth.loadUserData()
          Dialog.create({
            title: "Success",
            message: "Points added successfully",

            ok: true,
            color: "positive",
          })
          // return actions.order?.authorize()
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
  },
})
</script>
