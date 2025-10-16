<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h4 Claim Promo Code
  div.q-pt-md
    .centered
      .q-ma-md
        h4.text-grey-8 {{ promoCode }}
    //- .centered.q-mb-md.q-gutter-md.q-mt-md
      //- q-btn(label="Load Promo Details" @click="loadPromoDetails()")
      //- q-btn(label="Claim Promo" @click="loadPromoDetails()" :disabled="!promoDetails")
    //- pre {{ promoDetails }}
    .centered(v-if="promoDetails")
      div(v-if="!promoDetails.claimedAt")
        .q-ma-md
          h4  This Promo Code is worth {{ promoDetails?.points }} points
        .centered.q-ma-md
          q-btn(label="Claim" @click="claimCode()" color="accent" size="lg" :disabled="!$userAuth.loggedIn")
        .centered.q-ma-md(v-if="!$userAuth.loggedIn")

          q-btn(label="You must Login First" @click="$router.push({name:'login'})" color="primary" )
      div(v-else).q-mt-md
        .q-ma-md
          h4 This Promo Code has already been claimed
    .centered(v-else)
      .q-ma-md
        h4  Promo Code not found

  //- .centered.q-gutter-lg.q-ma-md(v-else)
  //-   h2 You need to be logged in as an admin to view this page





</template>

<script lang="ts">
import { promoGetPromoCodeDetails, promoClaimPromoCode } from "lib/orval"
import { PromoCode } from "lib/api"
import { jwt } from "lib/jwt"
import { catchErr, longIdToShort, shortIdToLong } from "lib/util"
import { copyToClipboard, Dialog } from "quasar"
import { defineComponent } from "vue"
import { events } from "lib/eventsManager"

export default defineComponent({
  components: {},
  data() {
    return {
      promoCode: "",
      promoDetails: undefined as PromoCode | undefined,
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        // if (val) void this.load()
      },
    },
  },

  mounted() {
    const claimShortId = this.$route?.params?.claimShortId
    if (!claimShortId || typeof claimShortId != "string") return
    this.promoCode = claimShortId
    void this.loadPromoDetails()
  },
  methods: {
    async loadPromoDetails() {
      const claimCode = shortIdToLong(this.promoCode)
      try {
        const response = await promoGetPromoCodeDetails({ id: claimCode })
        this.promoDetails = response.data
      } catch (error) {
        catchErr(error)
        this.promoDetails = undefined
      }
    },
    async claimCode() {
      const claimCode = shortIdToLong(this.promoCode)
      try {
        await promoClaimPromoCode({ id: claimCode })
        try { events.promoClaimed({ code: this.promoCode }) } catch {}
        
        Dialog.create({
          title: "Success",
          message: "Promo code claimed successfully",
          ok: true,
          color: "positive",
        }).onDismiss(() => {
          void this.$userAuth.loadUserData()
          void this.$router.push({ name: "browse" })
        })
      } catch (error) {
        catchErr(error)
      }
    },
  },
})
</script>
