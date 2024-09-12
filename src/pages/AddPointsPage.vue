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
  .centered.q-mt-md
    h3 Select Points Package
  .centered.q-gutter-lg.q-pt-sm
    q-card.q-pa-lg.cursor-pointer( v-for="(pkg, index) in packages" @click="setAddPoints(index)" :class="pkgCardClass(pkg)" :key="pkg.points")
      .centered.q-pb-md
        h4 {{ pkg.points.toLocaleString() }} Points
      .centered.q-pa-sm(style="border-radius: 15px;" :class="pkg.bgColor")
        h4(v-if="pkg.discountPct > 0") {{ pkg.discountPct * 100 }}% Discount
        h4(v-else) No Discount
      .centered.q-pt-md
        h4 ${{ pkg.usd }}
  .centered.q-ma-md(v-if="selectedPkg").q-pt-lg
    h4 Adding {{ selectedPkg.points.toLocaleString() }} Points with a {{ selectedPkg.discountPct * 100 }}% discount will cost ${{ selectedPkg?.usd }}
  div.q-mt-lg(:class="!selectedPkg ? 'faded-out' : ''").q-mb-xl
    .centered
      div(ref="paypal" style="border-radius: 14px; width:400px; max-width:90vw").bg-grey-2.q-pa-md.rounded-box

</template>


<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import CreateCard from "components/CreateCard.vue"
import { StabilityAIContentResponse } from 'lib/types'
import { api } from 'lib/api'
import CreatedImageCard from 'components/CreatedImageCard.vue'
import { useCreateSession } from 'stores/createSessionStore'
import { payPal } from "lib/payPal"
import { PayPalButtonsComponent, PayPalNamespace } from "@paypal/paypal-js";
import { throwErr } from "lib/util"
import type { PointsPackageWithUsd } from "../../../fiddl-server/src/lib/pointsPackages"
interface PointsPackageRender extends PointsPackageWithUsd {
  bgColor: string
}

export default defineComponent({
  components: {
  },
  data() {
    return {
      userAuth: useUserAuth(),
      selectedPkg: null as null | PointsPackageRender,
      ppButton: null as null | PayPalButtonsComponent,
      packages: [] as PointsPackageRender[],
      selectedPkgIndex: null as null | number
    }
  },
  async mounted() {
    api.points.getPackages().then(res => {
      this.packages = res.map(el => {
        return {
          ...el,
          bgColor: el.discountPct > 0 ? 'bg-positive' : ''
        }
      })
    })
    if (this.userAuth.loggedIn) this.userAuth.loadUserData()

    this.initPPButton()

  },
  computed: {
  },
  methods: {
    pkgCardClass(pkg: PointsPackageRender) {
      return {
        "selected-box": this.selectedPkg?.points === pkg.points,
        "faded-out": !this.userAuth.loggedIn
      }
    },
    initPPButton() {
      if (!payPal?.Buttons) return
      this.ppButton = payPal.Buttons({
        style: {
          label: 'pay'
        },
        message: {
          amount: 0,
          position: 'bottom'
        },
        createOrder: async () => {
          if (this.selectedPkgIndex === null) throwErr('Failed to create order')
          const res = await api.points.initBuyPackage(this.selectedPkgIndex)
          if (!res) throwErr('Failed to create order')
          return res.id
        },

        onApprove: async (data, actions) => {
          const res = await api.points.completeBuyPackage(data.orderID)
          if (!res) throwErr('Failed to capture order')
          const errorDetail = res?.details?.[0];
          if (errorDetail?.issue === 'INSTRUMENT_DECLINED') {
            return actions.restart();
          }
          if (errorDetail) {
            console.error(errorDetail);
            throwErr('Failed to capture order: ', errorDetail)
          }
          this.userAuth.loadUserData()
        },
      },)
      const payPalDiv = this.$refs.paypal as HTMLDivElement
      if (!payPalDiv) return
      this.ppButton.render(payPalDiv)
    },
    setAddPoints(pkgIndex: number) {
      console.log('set add points', pkgIndex)
      this.selectedPkgIndex = pkgIndex
      this.selectedPkg = this.packages[pkgIndex]!
    },
  },
  watch: {
    selectedPkg() {
      if (!this.selectedPkg) return
      console.log('selected pkg', this.selectedPkg)
      this.ppButton?.updateProps({
        message: {
          amount: this.selectedPkg.usd,
          color: "black",
          position: 'bottom',
        },
      })
    },
    "userAuth.loggedIn": {
      immediate: false,
      handler() {
        // this.userAuth.loadUserData()
      }
    }
  }
})
</script>
