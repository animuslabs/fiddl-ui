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
          q-img(v-if="$userAuth.userId" :src="displayAvatarSrc" alt="avatar" width="100px" height="100px" placeholder-src="/blankAvatar.webp")
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
        h5.q-pt-md Linked Accounts
        q-card(flat bordered class="bg-dark-2 q-pa-md")
          q-list(separator)
            // Email
            q-item
              q-item-section(avatar)
                q-icon(name="email")
              q-item-section
                q-item-label Email
                q-item-label(caption)
                  span {{ (connections?.email?.address || $userAuth.userProfile?.email || 'No email').toLowerCase?.() || (connections?.email?.address || $userAuth.userProfile?.email || 'No email') }}
              q-item-section(side)
                template(v-if="connections?.email?.verified ?? $userAuth.userProfile?.emailVerified")
                  q-chip(outline color="positive" text-color="positive" icon="check") Verified
                template(v-else)
                  .row.items-center.q-gutter-sm
                    q-btn(flat color="positive" icon="link" label="Verify email" @click="linkEmail()")
                    q-chip(dense color="grey-8" text-color="white" icon="img:/FiddlPointsLogo.svg") +{{ linkRewards.linkEmail }} pts
            // Google
            q-item
              q-item-section(avatar)
                q-icon(name="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg")
              q-item-section
                q-item-label Google
                q-item-label(caption)
                  span {{ isGoogleLinked ? 'Connected' : 'Not connected' }}
              q-item-section(side)
                template(v-if="isGoogleLinked")
                  q-btn(flat color="negative" icon="link_off" label="Unlink" @click="onUnlinkProvider('google')")
                template(v-else)
                  .row.items-center.q-gutter-sm
                    q-btn(flat color="primary" icon="link" label="Link" @click="onLinkProvider('google')")
                    q-chip(dense color="grey-8" text-color="white" icon="img:/FiddlPointsLogo.svg") +{{ linkRewards.linkGoogle }} pts
            // X (Twitter)
            q-item
              q-item-section(avatar)
                q-icon(name="img:/x-logo.svg")
              q-item-section
                q-item-label X (Twitter)
                q-item-label(caption)
                  span(v-if="twitterHandle") @{{ twitterHandle }}
                  span(v-else) {{ isTwitterLinked ? 'Connected' : 'Not connected' }}
              q-item-section(side)
                template(v-if="isTwitterLinked")
                  q-btn(flat color="negative" icon="link_off" label="Unlink" @click="onUnlinkProvider('twitter')")
                template(v-else)
                  .row.items-center.q-gutter-sm
                    q-btn(flat color="primary" icon="link" label="Link" @click="onLinkProvider('twitter')")
                    q-chip(dense color="grey-8" text-color="white" icon="img:/FiddlPointsLogo.svg") +{{ linkRewards.linkTwitter }} pts
            // Telegram
            q-item
              q-item-section(avatar)
                q-icon(name="fa-brands fa-telegram")
              q-item-section
                q-item-label Telegram
                q-item-label(caption)
                  span(v-if="tgTelegramName") Connected as {{ tgTelegramName }}
                  span(v-else) {{ tgLinked ? 'Connected' : 'Not connected' }}
              q-item-section(side)
                template(v-if="tgLinked")
                  q-btn(flat color="negative" icon="link_off" label="Unlink" @click="onUnlinkTelegram")
                template(v-else)
                  .row.items-center.q-gutter-sm
                    TelegramConnect(mode="link" button-label="Connect" @linked="onTgLinked")
                    q-chip(dense color="grey-8" text-color="white" icon="img:/FiddlPointsLogo.svg") +{{ linkRewards.linkTelegram }} pts
            div(v-if="!tgLinked" class="q-mt-sm") If you have Telegram Premium, you'll earn 100 extra Points
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

        h6.q-pt-md Notifications
        .row(v-if="$userAuth.notificationConfig")
          //- pre {{ $userAuth.notificationConfig }}
          .row.items-center.q-gutter-md
            q-toggle(v-model="$userAuth.notificationConfig.email" label="Email Notifications" @click="updateNotificationConfig()")
            q-select(@popup-hide="updateNotificationConfig()" v-model="$userAuth.notificationConfig.emailFrequency" label="Email Frequency" :options="['instant', 'daily', 'weekly','monthly']" :disable="$userAuth.notificationConfig.email == false" style="width: 140px; text-transform: capitalize;")
        q-separator.q-my-lg(color="grey-8" inset)
        h6.text-negative Danger Zone
        q-card(flat bordered class="bg-dark-2 q-pa-md q-mt-sm")
          .column.q-gutter-sm
            div.text-white Delete account
            small.text-grey-4(style="max-width: 420px;") We'll send a confirmation link to your verified contact. You must approve the request via email or Telegram before your account is removed.
            q-input(v-model="deleteAccountEmail" type="email" label="Email for confirmation (optional)" :disable="deleteAccountLoading" clearable)
            q-btn(color="negative" icon="delete" label="Request account deletion" :loading="deleteAccountLoading" :disable="deleteAccountLoading" @click="requestAccountDeletion")
            q-alert(v-if="deleteAccountStatusMessage" dense :color="deleteAccountStatusColor" text-color="white" class="q-mt-sm" :icon="deleteAccountMethod === 'telegram' ? 'send' : deleteAccountMethod === 'email' ? 'mail' : 'info'")
              div {{ deleteAccountStatusMessage }}
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
// JWT is handled by axios interceptors in boot; no direct use here
import {
  telegramCreateDeepLink,
  telegramLinkStatus,
  userSetBio,
  userSetNotificationConfig,
  userRequestDeleteAccount,
  userSetUsername,
  discountsMyCodes,
  userGetAffiliatePayoutDetails,
  userSetAffiliatePayoutDetails,
  userAffiliatePayoutReceipts,
  userReferralsSummary,
  userAuthConnections,
  type DiscountsMyCodes200Item,
  type TelegramCreateDeepLink200,
  type UserAffiliatePayoutReceipts200Item,
  type UserReferralsSummary200,
  type UserRequestDeleteAccount200Method,
} from "src/lib/orval"
import { usdToString } from "src/lib/discount"
import { requestEmailLoginCode, completeEmailLoginWithCode, startOAuthLogin, unlinkOAuthProvider } from "src/lib/oauth"
import { usePricesStore } from "src/stores/pricesStore"
import { telegramUnlink } from "src/lib/orval"
import { defineComponent } from "vue"
import { getTelegramProfilePhoto, isTmaMode } from "lib/tmaProfile"

type DiscountCodeWithPayouts = DiscountsMyCodes200Item & { pendingPayout?: number; totalPayout?: number }

type AuthConnections = {
  email: { address: string | null; verified: boolean; linked?: boolean }
  google: { linked: boolean }
  twitter: { linked: boolean; handle: string | null; verified?: boolean }
  telegram: { linked: boolean; id: string | null; name: string | null }
  phone?: { number: string | null; verified: boolean }
  tonid?: boolean
  passkeys?: number
}

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
      pricesStore: usePricesStore(),
      connections: null as AuthConnections | null,
      editingUsername: false,
      newUsername: "",
      validateUsername,
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
      deleteAccountEmail: "",
      deleteAccountLoading: false,
      deleteAccountMethod: null as UserRequestDeleteAccount200Method | null,
      deleteAccountStatusMessage: "",
      deleteAccountStatusColor: "positive" as string,
    }
  },
  computed: {
    linkRewards(): { linkEmail: number; linkGoogle: number; linkPhone: number; linkTelegram: number; linkTwitter: number } {
      return this.pricesStore.prices.socialRewards
    },
    isGoogleLinked(): boolean {
      if (this.connections) return Boolean(this.connections.google.linked)
      return Boolean(this.$userAuth.userData?.googleId)
    },
    isTwitterLinked(): boolean {
      if (this.connections) return Boolean(this.connections.twitter.linked)
      return Boolean(this.$userAuth.userData?.twitterId) || Boolean(this.$userAuth.userProfile?.twitterVerified)
    },
    twitterHandle(): string | null {
      if (this.connections) return this.connections.twitter.handle
      return this.$userAuth.userProfile?.twitter || null
    },
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
    displayAvatarSrc(): string {
      try {
        const userId = this.$userAuth.userId
        if (!this.hasAvatar && isTmaMode()) {
          const telegramPhoto = getTelegramProfilePhoto()
          if (telegramPhoto) return telegramPhoto
        }
        if (userId) return avatarImg(userId)
      } catch {}
      return "/blankAvatar.webp"
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
        void this.loadAuthConnections()
        void this.loadReferralsSummary()
      },
    },
    $userAuth: {
      immediate: true,
      deep: true,
      handler(val) {
        if (!val.userProfile) return
        this.userBio = val.userProfile.bio || ""
        if (!this.deleteAccountEmail) {
          const email = val.userProfile.email || ""
          if (email) this.deleteAccountEmail = email
        }
      },
    },
  },
  mounted() {},
  beforeUnmount() {
    if (this.countdownTimer) clearInterval(this.countdownTimer)
    if (this.tgPollTimer) clearInterval(this.tgPollTimer)
  },
  methods: {
    async loadAuthConnections() {
      if (!this.$userAuth.loggedIn) return
      try {
        const { data } = await userAuthConnections()
        const conn: AuthConnections = {
          email: { address: data.email?.address ?? null, verified: Boolean(data.email?.verified), linked: Boolean(data.email?.linked) },
          google: { linked: Boolean(data.google) },
          twitter: { linked: Boolean(data.x), handle: this.$userAuth.userProfile?.twitter || null, verified: Boolean(this.$userAuth.userProfile?.twitterVerified) },
          telegram: { linked: Boolean(data.telegram?.linked), id: data.telegram?.id ?? null, name: data.telegram?.name ?? null },
          phone: this.$userAuth.userProfile ? { number: this.$userAuth.userProfile.phone || null, verified: Boolean(this.$userAuth.userProfile.phoneVerified) } : undefined,
          tonid: Boolean((data as any).tonid),
          passkeys: Number((data as any).passkeys ?? 0),
        }
        this.connections = conn
        this.tgLinked = Boolean(conn.telegram.linked)
        this.tgTelegramId = conn.telegram.id
        this.tgTelegramName = conn.telegram.name
        if (!this.deleteAccountEmail && conn.email.address) {
          this.deleteAccountEmail = conn.email.address
        }
      } catch (e) {
        // Fallback with orval telegram status + profile
        try {
          const { data } = await telegramLinkStatus()
          const extra = (data?.data || null) as any
          if (data?.linked || extra?.telegramId) {
            this.tgLinked = true
            this.tgTelegramId = extra?.telegramId || null
            this.tgTelegramName = extra?.telegramName || null
          }
        } catch {}
        this.connections = {
          email: { address: this.$userAuth.userProfile?.email || null, verified: Boolean(this.$userAuth.userProfile?.emailVerified) },
          google: { linked: Boolean(this.$userAuth.userData?.googleId) },
          twitter: { linked: Boolean(this.$userAuth.userData?.twitterId) || Boolean(this.$userAuth.userProfile?.twitterVerified), handle: this.$userAuth.userProfile?.twitter || null, verified: Boolean(this.$userAuth.userProfile?.twitterVerified) },
          telegram: { linked: this.tgLinked, id: this.tgTelegramId, name: this.tgTelegramName },
          phone: { number: this.$userAuth.userProfile?.phone || null, verified: Boolean(this.$userAuth.userProfile?.phoneVerified) },
        }
        if (!this.deleteAccountEmail && this.connections.email.address) {
          this.deleteAccountEmail = this.connections.email.address
        }
      }
    },
    onLinkProvider(provider: "google" | "twitter") {
      try {
        const rt = "/settings"
        startOAuthLogin(provider, { mode: "link", returnTo: rt })
      } catch (e) {
        catchErr(e)
      }
    },
    async onUnlinkProvider(provider: "google" | "twitter") {
      try {
        Dialog.create({
          title: `Unlink ${provider === "twitter" ? "X" : "Google"}?`,
          message: `Are you sure you want to unlink your ${provider === "twitter" ? "X" : "Google"} account? You can re-link later.`,
          ok: { label: "Unlink", flat: true, color: "negative" },
          cancel: true,
          persistent: true,
        }).onOk(async () => {
          try {
            Loading.show({ message: "Unlinking..." })
            await unlinkOAuthProvider(provider)
            await this.$userAuth.loadUserData()
            await this.$userAuth.loadUserProfile()
            await this.loadAuthConnections()
            Notify.create({ type: "positive", message: `${provider === "twitter" ? "X" : "Google"} account unlinked` })
          } catch (err) {
            catchErr(err)
          } finally {
            Loading.hide()
          }
        })
      } catch (e) {
        catchErr(e)
      }
    },
    async onUnlinkTelegram() {
      try {
        Dialog.create({
          title: "Unlink Telegram?",
          message: "Unlink this Fiddl account from your Telegram account?",
          ok: { label: "Unlink", flat: true, color: "negative" },
          cancel: true,
          persistent: true,
        }).onOk(async () => {
          try {
            Loading.show({ message: "Unlinking Telegram..." })
            await telegramUnlink()
            this.tgLinked = false
            this.tgTelegramId = null
            this.tgTelegramName = null
            await this.$userAuth.loadUserProfile()
            await this.$userAuth.loadUserData()
            await this.loadAuthConnections()
            Notify.create({ type: "positive", message: "Telegram unlinked" })
          } catch (err) {
            catchErr(err)
          } finally {
            Loading.hide()
          }
        })
      } catch (e) {
        catchErr(e)
      }
    },
    copyCode(code: string) {
      void copyToClipboard(code)
      Notify.create({ message: "Code copied", color: "positive", icon: "check" })
    },
    async loadMyCodes() {
      try {
        this.loadingMyCodes = true
        const res = await discountsMyCodes()
        const list = Array.isArray(res?.data) ? res.data : []
        // Enrich with payout fields from backend (affiliatePayoutPending / affiliatePaid)
        this.myCodes = list.map((it) => {
          const raw = it as unknown as Record<string, unknown>
          const toNum = (v: unknown) => {
            const n = Number(v)
            return Number.isFinite(n) ? n : 0
          }
          return {
            ...it,
            // Keep legacy keys used by the UI, derived from new API fields
            pendingPayout: toNum(raw.affiliatePayoutPending ?? (raw as any).pendingPayout),
            totalPayout: toNum(raw.affiliatePaid ?? (raw as any).totalPayout),
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
      void this.loadAuthConnections()
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
              await this.loadAuthConnections()
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
    async requestAccountDeletion() {
      if (this.deleteAccountLoading) return
      const email = (this.deleteAccountEmail || "").trim()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Notify.create({ type: "negative", message: "Please enter a valid email address." })
        this.deleteAccountMethod = null
        this.deleteAccountStatusMessage = "Please enter a valid email or leave the field blank to use your linked contacts."
        this.deleteAccountStatusColor = "negative"
        return
      }
      try {
        this.deleteAccountLoading = true
        this.deleteAccountMethod = null
        this.deleteAccountStatusMessage = ""
        this.deleteAccountStatusColor = "positive"
        const payload = email ? { email } : undefined
        const { data } = await userRequestDeleteAccount(payload)
        if (!data?.ok) {
          const reason = data?.reason || "Unable to request account deletion."
          this.deleteAccountMethod = null
          this.deleteAccountStatusMessage = reason
          this.deleteAccountStatusColor = "negative"
          Notify.create({ type: "negative", message: reason })
          return
        }

        this.deleteAccountMethod = data.method ?? null
        let message = "We sent confirmation instructions to your linked contact."
        if (data.method === "telegram") {
          const tgName = this.tgTelegramName ? ` ${this.tgTelegramName}` : ""
          message = `Check Telegram${tgName ? ` (${tgName})` : ""} for a message to confirm the deletion request.`
        } else if (data.method === "email") {
          const targetEmailRaw = (email || this.connections?.email?.address || this.$userAuth.userProfile?.email || "your email").toString()
          const targetEmail = targetEmailRaw.includes("@") ? targetEmailRaw.toLowerCase() : targetEmailRaw
          message = `We sent a confirmation email to ${targetEmail}. Follow the link to finish deleting your account.`
        }

        this.deleteAccountStatusMessage = message
        this.deleteAccountStatusColor = "positive"
        Notify.create({ type: "positive", message })
      } catch (err) {
        this.deleteAccountStatusColor = "negative"
        this.deleteAccountStatusMessage = "Couldn't request account deletion. Please try again later."
        this.deleteAccountMethod = null
        catchErr(err)
      } finally {
        this.deleteAccountLoading = false
      }
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
