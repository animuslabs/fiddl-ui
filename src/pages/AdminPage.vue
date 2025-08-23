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
            q-btn(label="Create + Copy Claim Link" @click="createPromoCode('claim')" icon="add")
            q-btn(label="Create + Copy MagicMirror Link" class="q-ml-sm" @click="createPromoCode('mm')" icon="add")
      .centered.q-gutter-md
        q-card.q-pa-md(style="max-width:400px; overflow: auto;")
          .centered
            h4 Unclaimed Promo Codes
          q-list
            q-item(v-for="code in unclaimedPromoCodes" :key="code.id")
              pre(style="font-size:10px; white-space:pre-wrap; max-width:90vw; overflow:auto;") {{ code }}
              .row.q-gutter-xs.q-mt-xs
                q-btn(size="sm" label="copy claim" @click="copyCode(code.id)" icon="content_copy" flat)
                q-btn(size="sm" label="copy MM" @click="copyMagicMirror(code.id)" icon="content_copy" flat)
                q-btn(size="sm" label="claim QR" @click="showClaimQr(code.id)" icon="qr_code" color="primary" flat)
                q-btn(size="sm" label="MM QR" @click="showMmQr(code.id)" icon="qr_code" color="accent" flat)
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





// Fullscreen QR dialog
q-dialog(v-model="qrDialogOpen" maximized)
  q-card.q-dialog-plugin(style="width:100vw; max-width:100vw; background-color:#000;")
    .centered.full-width.q-pa-lg(style="min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;")
      h5.text-white.q-mb-md {{ qrTitle }}
      q-spinner(color="primary" size="120px" v-if="qrLoading || !qrDataUrl")
      q-img(
        v-if="qrDataUrl && !qrLoading"
        :src="qrDataUrl"
        style="width:min(92vw, 600px); height:auto;"
        no-spinner
      )
      .row.justify-center.q-gutter-sm.q-mt-lg
        q-btn(color="primary" icon="content_copy" label="Copy Link" @click="copyQrLink" rounded)
        q-btn(color="grey-7" icon="close" label="Close" @click="qrDialogOpen = false" flat rounded)
</template>

<script lang="ts">
import { PromoCode, User } from "lib/api"
import { jwt } from "lib/jwt"
import { avatarImg } from "lib/netlifyImg"
import { longIdToShort, catchErr } from "lib/util"
import { copyToClipboard, Dialog, Notify } from "quasar"
import { defineComponent } from "vue"
import { promoCreatePromoCode, promoGetPromoCodes, userAllUsers } from "src/lib/orval"
import QRCode from "qrcode"

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
      qrDialogOpen: false as boolean,
      qrLink: '' as string,
      qrTitle: '' as string,
      qrDataUrl: '' as string,
      qrLoading: false as boolean,
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
    copyMagicMirror(codeId: string) {
      const mmUrl = `${window.location.origin}/magicMirror?claimCode=${longIdToShort(codeId)}`
      void copyToClipboard(mmUrl)
      Notify.create({ message: "Magic Mirror promo link copied to clipboard", color: "positive", icon: "check" })
    },
    showClaimQr(codeId: string) {
      const claimUrl = `${window.location.origin}/claim/${longIdToShort(codeId)}`
      void this.openQr(claimUrl, 'Claim Promo')
    },
    showMmQr(codeId: string) {
      const mmUrl = `${window.location.origin}/magicMirror?claimCode=${longIdToShort(codeId)}`
      void this.openQr(mmUrl, 'Magic Mirror')
    },
    async openQr(link: string, title = 'Scan QR') {
      try {
        this.qrDialogOpen = true
        this.qrLink = link
        this.qrTitle = title
        this.qrLoading = true
        this.qrDataUrl = await QRCode.toDataURL(link, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 1024,
          color: { dark: '#000000', light: '#ffffff' },
        })
      } catch (error) {
        catchErr(error)
      } finally {
        this.qrLoading = false
      }
    },
    copyQrLink() {
      if (!this.qrLink) return
      void copyToClipboard(this.qrLink)
      Notify.create({ message: "Link copied", color: "positive", icon: "check" })
    },
    async createPromoCode(kind: 'claim' | 'mm' = 'claim') {
      try {
        const response = await promoCreatePromoCode({ points: this.promoPoints ? Number(this.promoPoints) : 0 })
        const code = response?.data
        if (!code) return

        const shortId = longIdToShort(code.id)
        const claimUrl = `${window.location.origin}/claim/${shortId}`
        const mmUrl = `${window.location.origin}/magicMirror?claimCode=${shortId}`
        const urlToCopy = kind === 'mm' ? mmUrl : claimUrl
        void copyToClipboard(urlToCopy)
        void this.openQr(urlToCopy, kind === 'mm' ? 'Magic Mirror' : 'Claim Promo')
        void this.load()
        Notify.create({
          message: kind === 'mm'
            ? `Promo created (${this.promoPoints} points). Magic Mirror link copied`
            : `Promo created (${this.promoPoints} points). Claim link copied`,
          type: "success",
          color: "positive",
          icon: "check",
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
