<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Account Settings
  .centered.q-gutter-md.q-mt-md
    q-card(v-if="$userAuth.loggedIn")
      q-card-section
        .row.q-gutter-md.items-center
          //- h3 Account Settings
          q-btn(@click="$router.push({name:'profile',params:{username:$userAuth.userProfile?.username}})" icon="link" flat size="sm" :disable="!$userAuth.userProfile?.username" label="Account Profile")
            q-tooltip
              p View your public profile
        .centered.q-mt-md
          q-img(v-if="$userAuth.userId" :src="avatarImg($userAuth.userId)" alt="avatar" width="100px" height="100px" placeholder-src="/blankAvatar.webp")
            q-tooltip(slot="overlay")
              p To change your Avatar, use the button at the top right when viewing an image
        .centered.q-mt-sm
          h5 {{ $userAuth.userProfile?.username || "no username" }}
        div(v-if="!hasAvatar")
          h6 Avatar
            p(style="max-width:400px;") To change your Avatar, use the button at the top right when viewing an image
        h5 Bio
          q-btn(icon="edit" size="sm" round flat v-if="!bioEditMode" @click="bioEditMode = true")
            q-tooltip()
              p Edit Bio
          q-input(v-model="userBio" type="textarea" autogrow clearable :disable="!bioEditMode" counter :rules="[v => v.length <= 200 || 'Max 200 characters']")
          .row.q-gutter-md.q-pt-md.justify-end.full-width(v-if="bioEditMode")
            q-btn(icon="close"  label="cancel" flat color="negative" @click="bioEditMode = false; userBio = $userAuth.userProfile?.bio || ''")
            q-btn(icon="check" label="update Bio" flat color="positive" @click="updateBio()")
        //- .row.q-gutter-md.items-center
        //-   .col-auto(v-if="$userAuth.userProfile?.bio")
        //-     q-input(v-model="$userAuth.userProfile?.bio" type="textarea")
        h5.q-mt-md Username
        .row.q-gutter-md.items-center(v-if="!editingUsername")
          .col-auto
            p {{ $userAuth.userProfile?.username || "no username" }}
          .col-auto
            div
              q-btn(@click="editingUsername = true" round flat icon="edit" size="sm" )
          .col-grow
          .col-auto
            div
              q-btn(v-if="$userAuth.userProfile?.username" label="Get Referral Link" @click="copyRefLink()")
              div(v-else) Set a username to get a referral link
        .row.q-gutter-md.items-center(v-else)
          .col-auto
            q-input.q-pb-md( prefix="@" v-model="newUsername" label="Username" :rules="[validateUsername]" clearable)
          .col-auto
            div
              q-btn(@click="editingUsername = false" round flat icon="close" color="negative")
              q-btn(@click="setNewUsername()" round flat icon="check" color="positive")
        // Referral summary chips
        .row.q-gutter-sm.q-mt-sm(v-if="$userAuth.userProfile?.username")
          div(v-if="referralsLoading" class="q-ml-sm")
            q-spinner(size="20px" color="primary")
          template(v-else)
            q-badge(color="grey-9" text-color="white" )
              q-icon(name="group")
              .q-ml-sm Invited: {{ referralsSummary?.invitedCount ?? 0 }}
            q-badge( color="grey-9" text-color="white" icon="img:/FiddlPointsLogo.svg")
              q-icon(name="img:/FiddlPointsLogo.svg" class="q-ml-sm")
              .q-ml-sm Earned: {{ referralsSummary?.earnedReferralPoints ?? 0 }} Points
        div(style="max-width: 400px;").q-mt-md
          small You will earn a 5% Fiddl Points bonus when users who register using your referral link purchase Fiddl Points.
        h5.q-pt-md Email
        .row.items-center
          div
            p {{ $userAuth.userProfile?.email?.toLowerCase() || "no email" }}
          div.q-ml-md
            q-icon(v-if="$userAuth.userProfile?.emailVerified" name="check" color="positive" size="sm")
            q-icon(v-else name="close" color="negative" size="sm")
          .q-ma-md(v-if="!$userAuth.userProfile?.emailVerified")
            q-btn( @click="linkEmail()" label="Verify your email" flat color="positive" icon="link" size="md")
        .centered(v-if="!$userAuth.userProfile?.emailVerified")
          small.text-positive Earn 100 Points when you link your email
        //- h6.q-pt-md Link Telegram
        //- .row.items-center.q-gutter-sm
        //-   q-btn(@click="linkTelegram()" label="Link Telegram" color="primary" flat icon="fa-brands fa-telegram")
        // Telegram linking panel
        .q-mt-lg
          .row.items-center.q-gutter-sm
            h5 Telegram
            q-badge(v-if="tgStatusChecked" :color="tgLinked ? 'positive' : 'warning'" class="q-ml-sm") {{ tgLinked ? (tgTelegramName ? `Connected as ${tgTelegramName}` : 'Connected') : 'Not Connected' }}
          div(v-if="!tgLinked" class="q-mt-sm")
            div.q-mb-sm Connect your Fiddl account to our Telegram bot to receive updates and buy points with Stars.
            TelegramConnect(mode="link" @linked="onTgLinked")
          div.q-mt-sm(v-if="tgStatusChecked && !tgLinked")
            div If you have Telegram Premium, you'll earn 100 extra Points
          div(v-else class="q-mt-sm")
            p You are connected to Telegram.
          // Stars purchase moved to Add Points page
          // (See AddPointsPage → Telegram Stars toggle)
        // Legacy widget mount (unused)
        .q-mt-sm
          div(ref="telegramLinkMount")
        // Discount Codes (optional)
        div(v-if="myCodes && myCodes.length > 0").q-mt-lg
          .row.items-center.q-gutter-sm
            h5.q-mt-none.q-mb-none Discount Codes
          .row
            div Share your codes with your friends & followers to give them a discount and earn rewards.
          .row
            div Codes can be applied when purchasing Fiddl Points. Affiliate earnings are credited monthly.
          .q-mt-sm
            div(v-for="c in myCodes" :key="c.code" class="q-pa-md q-mb-sm rounded-borders bg-dark-2")
              .row.items-center.justify-between
                .row.items-center.q-gutter-sm
                  h4.q-my-none.text-white {{ c.code }}
                  q-btn(flat round size="sm" icon="content_copy" @click="copyCode(c.code)")
                    q-tooltip Copy code
                  q-badge(:color="c.active ? 'positive' : 'grey'" :label="c.active ? 'Active' : 'Inactive'")
                .col-auto
                  q-badge(color="primary" text-color="white") {{ (c.discount * 100).toFixed(0) }}% off
              .row.q-gutter-sm.q-mt-sm
                q-badge(color="grey-8" text-color="white") Used {{ c.used }} / {{ c.maximumUses ?? '∞' }}
                q-badge(color="grey-8" text-color="white") Unique users {{ c.uniqueUsers ?? 0 }}
              .row.q-gutter-sm.q-mt-sm
                q-badge(color="grey-8" text-color="white") Spent ${{ usdToString(c.totalUsdSpent || 0) }}
                q-badge(color="grey-8" text-color="white") Total Paid Out: ${{ usdToString(c.totalPayout || 0) }}
                q-badge(color="grey-4" text-color="black") Pending Payout: ${{ usdToString(c.pendingPayout || 0) }}
              //- .row.q-gutter-sm.q-mt-sm.text-white
                div Created {{ new Date(c.createdAt).toLocaleDateString() }}
                div(v-if="c.lastUsedAt") • Last used {{ new Date(c.lastUsedAt).toLocaleString() }}
          // Affiliate payout section
          .q-mt-lg
            .row.items-center.q-gutter-sm
              h5.q-mt-none.q-mb-none Affiliate Payout
            .row.items-center.justify-between.q-mt-xs
              .row.items-center.q-gutter-sm
                div(v-if="affiliateLoading")
                  q-spinner(size="20px" color="primary")
                template(v-else)
                  div.text-white
                    span PayPal Email:
                    span.q-ml-xs {{ affiliatePaypalEmail || 'Not linked' }}
              .col-auto
                q-btn(:label="affiliatePaypalEmail ? 'Update' : 'Link PayPal'" color="primary" icon="payments" flat @click="promptUpdateAffiliatePaypal" :loading="affiliateLoading")
            .row.q-gutter-sm.q-mt-sm
              q-badge(color="grey-8" text-color="white") Total Paid: ${{ usdToString(affiliateTotalPaid || 0) }}
              q-badge(color="grey-8" text-color="white") Payouts are processed monthly
          // Affiliate payout receipts
          .q-mt-md
            .row.items-center.q-gutter-sm
              h6.q-mt-none.q-mb-none Payout Receipts
              q-space
              q-btn(flat dense icon="refresh" @click="loadAffiliateReceipts" :loading="affiliateReceiptsLoading")
            div(v-if="affiliateReceiptsLoading" class="q-mt-sm")
              q-spinner(size="24px" color="primary")
            q-table(v-else
              :rows="affiliateReceipts"
              :columns="affiliateReceiptsColumns"
              row-key="id"
              flat bordered dense
              :rows-per-page-options="[10,25,50,0]"
              :no-data-label="'No payout receipts yet'"
            )
        // QR Code dialog for Telegram linking (desktop)
        q-dialog(v-model="tgQrDialogOpen" :maximized="isMobile")
          q-card(style="width:520px; max-width:100vw;")
            q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
              .row.items-center.justify-between
                h6.q-mt-none.q-mb-none Scan with your phone to login via Telegram
                q-btn(flat dense round icon="close" v-close-popup)
            q-separator
            q-card-section
              .centered
                q-spinner(v-if="tgQrLoading || !tgQrDataUrl" color="primary" size="120px")
                q-img(v-else :src="tgQrDataUrl" style="width:min(92vw, 600px); height:auto;" no-spinner)
              .centered.q-mt-md
                q-btn(v-if="deepLink?.deepLink" type="a" :href="deepLink?.deepLink" target="_blank" color="primary" icon="fa-brands fa-telegram" label="Open Telegram on this device" rounded)
                q-btn(color="grey-7" icon="close" label="Close" flat rounded v-close-popup).q-ml-sm
        h6.q-pt-md Notifications
        .row(v-if="$userAuth.notificationConfig")
          //- pre {{ $userAuth.notificationConfig }}
          .row.items-center.q-gutter-md
            q-toggle(v-model="$userAuth.notificationConfig.email" label="Email Notifications" @click="updateNotificationConfig()")
            q-select(@popup-hide="updateNotificationConfig()" v-model="$userAuth.notificationConfig.emailFrequency" label="Email Frequency" :options="['instant', 'daily', 'weekly','monthly']" :disable="$userAuth.notificationConfig.email == false" style="width: 140px; text-transform: capitalize;")
    .centered.q-mt-md(v-else)
      h4 Please login to view your account
</template>

<script lang="ts">
import { avatarImg } from "lib/netlifyImg"
import { catchErr } from "lib/util"
import QRCode from "qrcode"
import { copyToClipboard, Dialog, Loading, Notify, useQuasar } from "quasar"
import type { QTableColumn } from "quasar"
import PointsTransfer from "src/components/PointsTransfer.vue"
import TelegramConnect from "src/components/TelegramConnect.vue"
import { jwt } from "src/lib/jwt"
import { telegramCreateDeepLink, telegramLinkStatus, userSetBio, userSetNotificationConfig, userSetUsername, discountsMyCodes, userGetAffiliatePayoutDetails, userSetAffiliatePayoutDetails, userAffiliatePayoutReceipts, userReferralsSummary, type DiscountsMyCodes200Item, type TelegramCreateDeepLink200, type UserAffiliatePayoutReceipts200Item, type UserReferralsSummary200 } from "src/lib/orval"
import { usdToString } from "src/lib/discount"
import { requestEmailLoginCode, completeEmailLoginWithCode } from "src/lib/oauth"
import { defineComponent } from "vue"

type DiscountCodeWithPayouts = DiscountsMyCodes200Item & { pendingPayout?: number; totalPayout?: number }

function validateUsername(username: string): string | true {
  // This regex allows letters, numbers, underscores, hyphens, and emojis, but no spaces
  const usernameRegex = /^[\w\p{Emoji}-]{2,15}$/u

  if (!username) {
    return "Username is required."
  }
  if (username.length < 2) {
    return "Username must be at least 2 characters."
  }
  if (username.length > 15) {
    return "Username must not exceed 15 characters."
  }
  if (!usernameRegex.test(username)) {
    return "Username can only contain letters, numbers, underscores, hyphens, and emojis."
  }

  return true
}

export default defineComponent({
  components: { PointsTransfer, TelegramConnect },
  data() {
    return {
      quasar: useQuasar(),
      editingUsername: false,
      newUsername: "",
      validateUsername,
      avatarImg,
      usdToString,
      userBio: "",
      bioEditMode: false,
      // Discount Codes
      myCodes: [] as DiscountCodeWithPayouts[],
      loadingMyCodes: false,
      // Affiliate payout
      affiliateLoading: false,
      affiliatePaypalEmail: null as string | null,
      affiliateTotalPaid: 0 as number,
      // Payout receipts
      affiliateReceiptsLoading: false,
      affiliateReceipts: [] as UserAffiliatePayoutReceipts200Item[],
      // Telegram linking state
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
      // tgPackages moved to AddPointsPage
      tgQrDialogOpen: false as boolean,
      tgQrDataUrl: "" as string,
      tgQrLoading: false as boolean,
      // Table columns
      affiliateReceiptsColumns: [
        { name: "payoutDate", label: "Date", field: "payoutDate", sortable: true, format: (val: string) => (val ? new Date(val).toLocaleString() : "") },
        { name: "amount", label: "Amount", field: "amount", align: "right", sortable: true, format: (val: number) => `$${usdToString(val || 0)}` },
      ] as QTableColumn<any>[],
      // Referral summary
      referralsLoading: false as boolean,
      referralsSummary: null as UserReferralsSummary200 | null,
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
    hasAvatar() {
      return !!this.$userAuth.userData?.AvatarConfig
    },
    hasBio() {
      return !!this.$userAuth.userProfile?.bio
    },
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return this.quasar.screen.lt.md
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (!val) return
        this.loadData()
        void this.loadMyCodes()
        void this.checkTgStatus()
        void this.loadReferralsSummary()
      },
    },
    $userAuth: {
      immediate: true,
      deep: true,
      handler(val) {
        if (!val.userProfile) return
        this.userBio = val.userProfile.bio || ""
      },
    },
  },
  mounted() {},
  beforeUnmount() {
    if (this.countdownTimer) clearInterval(this.countdownTimer)
    if (this.tgPollTimer) clearInterval(this.tgPollTimer)
  },
  methods: {
    copyCode(code: string) {
      void copyToClipboard(code)
      Notify.create({ message: "Code copied", color: "positive", icon: "check" })
    },
    async loadMyCodes() {
      try {
        this.loadingMyCodes = true
        const res = await discountsMyCodes()
        const list = Array.isArray(res?.data) ? res.data : []
        // Enrich with payout fields from backend if present
        this.myCodes = list.map((it) => {
          const raw = it as unknown as Record<string, unknown>
          const toNum = (v: unknown) => {
            const n = Number(v)
            return Number.isFinite(n) ? n : 0
          }
          return {
            ...it,
            pendingPayout: toNum(raw.pendingPayout),
            totalPayout: toNum(raw.totalPayout),
          }
        })
        // If user has affiliate codes, load payout details
        if (this.myCodes.length > 0) {
          void this.loadAffiliatePayout()
          void this.loadAffiliateReceipts()
        }
      } catch (e) {
        // Optional section; ignore errors
        this.myCodes = []
      } finally {
        this.loadingMyCodes = false
      }
    },
    async loadAffiliatePayout() {
      try {
        this.affiliateLoading = true
        const res = await userGetAffiliatePayoutDetails()
        const data = res?.data
        this.affiliatePaypalEmail = data?.paypalEmail ?? null
        this.affiliateTotalPaid = Number(data?.totalPaid ?? 0)
      } catch (e) {
        // optional section
        this.affiliatePaypalEmail = null
        this.affiliateTotalPaid = 0
      } finally {
        this.affiliateLoading = false
      }
    },
    async loadAffiliateReceipts() {
      try {
        this.affiliateReceiptsLoading = true
        const res = await userAffiliatePayoutReceipts({ limit: 50, offset: 0 })
        this.affiliateReceipts = Array.isArray(res?.data) ? res.data : []
      } catch (e) {
        this.affiliateReceipts = []
      } finally {
        this.affiliateReceiptsLoading = false
      }
    },
    async loadReferralsSummary() {
      try {
        this.referralsLoading = true
        const { data } = await userReferralsSummary()
        this.referralsSummary = {
          invitedCount: Number(data?.invitedCount || 0),
          earnedReferralPoints: Number(data?.earnedReferralPoints || 0),
        }
      } catch (e) {
        // Optional info, ignore errors
        this.referralsSummary = { invitedCount: 0, earnedReferralPoints: 0 }
      } finally {
        this.referralsLoading = false
      }
    },
    async promptUpdateAffiliatePaypal() {
      const current = this.affiliatePaypalEmail || ""
      Dialog.create({
        title: this.affiliatePaypalEmail ? "Update PayPal Email" : "Link PayPal Email",
        message: "Enter the PayPal email to receive affiliate payouts",
        prompt: { model: current, type: "email" },
        cancel: true,
        ok: { label: this.affiliatePaypalEmail ? "Update" : "Link", color: "primary" },
      }).onOk(async (email) => {
        try {
          const e = String(email || "").trim()
          if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
            Notify.create({ type: "negative", message: "Please enter a valid email" })
            return
          }
          this.affiliateLoading = true
          await userSetAffiliatePayoutDetails({ paypalEmail: e })
          await this.loadAffiliatePayout()
          Notify.create({ type: "positive", message: "PayPal details updated" })
        } catch (err) {
          catchErr(err)
        } finally {
          this.affiliateLoading = false
        }
      })
    },
    async checkTgStatus() {
      try {
        const { data } = await telegramLinkStatus()
        this.tgLinked = Boolean(data.linked)
        const extra = (data?.data || null) as any
        this.tgTelegramId = extra && typeof extra === "object" && "telegramId" in extra ? String(extra.telegramId) : null
        this.tgTelegramName = extra && typeof extra === "object" && "telegramName" in extra ? String(extra.telegramName) : null
        // If backend linked flag lags, trust presence of telegramId
        if (!this.tgLinked && this.tgTelegramId) this.tgLinked = true
      } catch (e) {
        console.warn("Failed to check telegram link status", e)
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
        // Start countdown and polling
        this.countdownTotal = data.expiresIn
        this.countdown = data.expiresIn
        this.startCountdown()
        // Mobile: open deep link directly; Desktop: show QR dialog
        if (data.deepLink) {
          try {
            if (this.isMobile) {
              window.open(data.deepLink, "_blank")
            } else {
              await this.openTgQr()
            }
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
          this.tgQrDialogOpen = false
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
            this.tgQrDialogOpen = false
            const extra = data?.data as any
            this.tgTelegramId = extra?.telegramId || null
            this.tgTelegramName = extra?.telegramName || null
            void this.$userAuth.loadNotificationConfig()
          }
        } catch (e) {
          // ignore transient errors
        }
        if (this.countdown <= 0) {
          if (this.tgPollTimer) clearInterval(this.tgPollTimer)
          this.tgPollTimer = null
        }
      }, 2000)
    },
    async openTgQr() {
      if (!this.deepLink?.deepLink) return
      this.tgQrDialogOpen = true
      this.tgQrLoading = true
      try {
        this.tgQrDataUrl = await QRCode.toDataURL(this.deepLink.deepLink, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 1024,
          color: { dark: "#000000", light: "#ffffff" },
        })
      } catch (e) {
        catchErr(e)
      } finally {
        this.tgQrLoading = false
      }
    },
    // Stars purchase moved to AddPointsPage
    // Telegram linking handled by TelegramConnect component
    onTgLinked(payload: { telegramId?: string | null; telegramName?: string | null }) {
      this.tgLinked = true
      this.tgTelegramId = payload.telegramId || null
      this.tgTelegramName = payload.telegramName || null
      void this.$userAuth.loadNotificationConfig()
    },
    async updateBio() {
      await userSetBio({ bio: this.userBio || "" }).catch(catchErr)
      this.bioEditMode = false
    },
    async updateNotificationConfig() {
      if (!this.$userAuth.notificationConfig) return
      await userSetNotificationConfig(this.$userAuth.notificationConfig as any).catch(catchErr)
    },
    copyRefLink() {
      const refLink = window.location.origin + "/?referredBy=" + this.$userAuth.userProfile?.username
      void copyToClipboard(refLink)
      Notify.create({ message: "Referral link copied to clipboard", color: "positive", icon: "check" })
    },
    async setNewUsername() {
      try {
        await userSetUsername({ username: this.newUsername })
        this.editingUsername = false
        void this.$userAuth.loadUserProfile()
        Notify.create({ message: "Username updated", color: "positive", icon: "check" })
        void this.loadReferralsSummary()
      } catch (err) {
        console.error(err)
        Notify.create({ message: "Failed to update username", color: "negative", icon: "error" })
      }
    },
    async linkEmail() {
      Dialog.create({
        title: "Verify your email",
        message: "Enter your email to receive a login code",
        prompt: { model: this.$userAuth.userProfile?.email || "", type: "email" },
        cancel: true,
        persistent: true,
      }).onOk(async (email) => {
        const e = String(email || "").trim()
        if (!e) {
          Notify.create({ message: "Please enter a valid email", color: "negative", icon: "error" })
          return
        }
        try {
          Loading.show({ message: "Sending verification code..." })
          await requestEmailLoginCode(e)
          Loading.hide()
          Dialog.create({
            title: "Verification",
            message: `Enter the code sent to ${e}`,
            prompt: { model: "", type: "text" },
            cancel: true,
            persistent: true,
          }).onOk(async (code) => {
            try {
              Loading.show({ message: "Verifying code..." })
              const result = await completeEmailLoginWithCode(String(code || ""))
              await this.$userAuth.applyServerSession(result.userId, result.token)
              Loading.hide()
              Notify.create({ message: "Email verified", color: "positive", icon: "check" })
            } catch (e: any) {
              Loading.hide()
              catchErr(e)
            }
          })
        } catch (err: any) {
          Loading.hide()
          catchErr(err)
        }
      })
    },
    loadData() {
      void this.$userAuth.loadUserData()
      void this.$userAuth.loadUserProfile()
      void this.$userAuth.loadPointsHistory()
      void this.$userAuth.loadNotificationConfig()
    },
  },
})
</script>
