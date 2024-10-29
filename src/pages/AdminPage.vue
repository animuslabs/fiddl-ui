<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h4 Admin
  div(v-if="$userAuth.loggedIn && $userAuth.userData?.admin").q-pt-md
    .centered.q-mb-md
      q-card.q-pa-md
        .centered
          h4 Create Promo Code
        .q-ma-md
          q-input(v-model.number="promoPoints" type="number" label="Points")
        .centered
          q-btn(label="create" @click="createPromoCode()" icon="add")
    .centered.q-gutter-md
      q-card.q-pa-md(style="max-width:400px; overflow: auto;")
        .centered
          h4 Unclaimed Promo Codes
        q-list
          q-item(v-for="code in unclaimedPromoCodes" :key="code.id")
            pre(style="font-size:10px;") {{ code }}
            div
              q-btn(label="copy" @click="copyCode(code.id)" icon="content_copy" flat)
      q-card.q-pa-md
        .centered
          h4 Claimed Promo Codes
        q-list
          q-item(v-for="code in claimedPromoCodes" :key="code.id")
            pre {{ code }}

  .centered.q-gutter-lg.q-ma-md(v-else)
    h2 You need to be logged in as an admin to view this page





</template>

<script lang="ts">
import { PromoCode } from "lib/api"
import { jwt } from "lib/jwt"
import { longIdToShort } from "lib/util"
import { copyToClipboard, Dialog } from "quasar"
import { defineComponent } from "vue"

export default defineComponent({
  components: {},
  data() {
    return {
      promoPoints: 100,
      claimedPromoCodes: [] as PromoCode[],
      unclaimedPromoCodes: [] as PromoCode[],
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.load()
      },
    },
  },

  mounted() {},
  methods: {
    copyCode(codeId: string) {
      const claimUrl = `${window.location.origin}/claim/${longIdToShort(codeId)}`
      void copyToClipboard(claimUrl)
    },
    async createPromoCode() {
      const code = await this.$api.promo.createPromoCode.mutate({ points: this.promoPoints })

      const claimUrl = `${window.location.origin}/claim/${longIdToShort(code.id)}`
      void copyToClipboard(claimUrl)
      void this.load()
    },
    async load() {
      const allPromoCodes = await this.$api.promo.getPromoCodes.query()
      this.claimedPromoCodes = allPromoCodes
        .filter((code) => code.claimedAt)
        .sort((a, b) => new Date(a.claimedAt as string).getTime() - new Date(b.claimedAt as string).getTime())
        .reverse()
      this.unclaimedPromoCodes = allPromoCodes
        .filter((code) => !code.claimedAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .reverse()
    },
  },
})
</script>
