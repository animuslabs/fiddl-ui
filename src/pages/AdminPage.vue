<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h4 Admin
  div(v-if="$userAuth.loggedIn && $userAuth.userData?.admin").q-pt-md
    q-tabs(v-model="tab" ).q-mb-md
      q-tab( name="promo-codes" label="Promo Codes")
      q-tab(name="users" label="Users")
    div(v-if="tab == 'promo-codes'")
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
    div(v-if="tab == 'users'")
    .centered
      q-list
        q-item(v-for="user in users" :key="user.id")
          .row.items-center.q-gutter-md
            .col-auto
              q-btn(icon="login" flat @click="loginAsUser(user.id)")
            .col-auto
              q-img(:src="avatarImg(user.id)" style="width: 50px; height: 50px; border-radius: 50%;")
            .col
              h4 {{ user.Profile?.username }}
              small created
              p {{  new Date(user.createdAt).toLocaleString() }}
              small active
              p {{  new Date(user.updatedAt).toLocaleString() }}
            .col-auto
              p {{ user.Profile?.bio }}

  .centered.q-gutter-lg.q-ma-md(v-else)
    h2 You need to be logged in as an admin to view this page





</template>

<script lang="ts">
import { PromoCode, User } from "lib/api"
import { jwt } from "lib/jwt"
import { avatarImg } from "lib/netlifyImg"
import { longIdToShort, catchErr } from "lib/util"
import { copyToClipboard, Dialog, Notify } from "quasar"
import { defineComponent } from "vue"
import { promoCreatePromoCode, promoGetPromoCodes, userAllUsers } from "src/lib/orval"

export default defineComponent({
  components: {},
  data() {
    return {
      promoPoints: 100 as string | number | null,
      claimedPromoCodes: [] as PromoCode[],
      unclaimedPromoCodes: [] as PromoCode[],
      tab: "promo-codes",
      users: [] as User[],
      avatarImg,
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.load()
      },
    },
    tab() {
      void this.load()
    },
  },

  mounted() {},

  methods: {
    async loginAsUser(userId: string) {
      await this.$userAuth.adminLoginAsUser(userId)
      await this.$router.push({ name: "settings" })
    },
    copyCode(codeId: string) {
      const claimUrl = `${window.location.origin}/claim/${longIdToShort(codeId)}`
      void copyToClipboard(claimUrl)
    },
    async createPromoCode() {
      try {
        const response = await promoCreatePromoCode({ points: this.promoPoints ? Number(this.promoPoints) : 0 })
        const code = response?.data
        if (!code) return
        
        const claimUrl = `${window.location.origin}/claim/${longIdToShort(code.id)}`
        void copyToClipboard(claimUrl)
        void this.load()
        Notify.create({
          message: `Promo code with ${this.promoPoints} points created, copied URL to clipboard`,
          type: "success",
          color: "positive",
        })
      } catch (error) {
        catchErr(error)
      }
    },
    async load() {
      try {
        if (this.tab == "promo-codes") {
          const response = await promoGetPromoCodes()
          const allPromoCodes = response?.data || []
          
          this.claimedPromoCodes = allPromoCodes
            .filter((code) => code.claimedAt)
            .sort((a, b) => new Date(a.claimedAt as string).getTime() - new Date(b.claimedAt as string).getTime())
            .reverse()
          this.unclaimedPromoCodes = allPromoCodes
            .filter((code) => !code.claimedAt)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .reverse()
        } else if (this.tab == "users") {
          const response = await userAllUsers()
          const users = response?.data || []
          console.log(users)
          this.users = users
        }
      } catch (error) {
        catchErr(error)
      }
    },
  },
})
</script>
