<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Account Settings
  .centered.q-gutter-md.q-mt-md
    q-card(v-if="$userAuth.loggedIn")
      q-card-section
        .row.q-gutter-md.items-center
          h3 Profile
          q-btn(@click="$router.push({name:'profile',params:{username:$userAuth.userProfile?.username}})" icon="link" flat round size="sm" :disable="!$userAuth.userProfile?.username")
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
        h6 Bio
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
        h6.q-mt-md Username
        .row.q-gutter-md.items-center(v-if="!editingUsername")
          .col-auto
            h5 {{ $userAuth.userProfile?.username || "no username" }}
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
        div(style="max-width: 400px;").q-mt-md
          p You will earn a 10% Fiddl Points bonus when users who register using your referral link purchase Fiddl Points.
        h6.q-pt-md Email
        .row.items-center
          div
            h5 {{ $userAuth.userProfile?.email?.toLowerCase() || "no email" }}
          div.q-ml-md
            q-icon(v-if="$userAuth.userProfile?.emailVerified" name="check" color="positive" size="sm")
            q-icon(v-else name="close" color="negative" size="sm")
          .q-ma-md(v-if="!$userAuth.userProfile?.emailVerified")
            q-btn( @click="linkPrivyEmail()" label="Link your email" flat color="positive" icon="link" size="md")
        .centered(v-if="!$userAuth.userProfile?.emailVerified")
          small.text-positive Earn 100 Points when you link your email
        //- h6.q-pt-md Link Telegram
        //- .row.items-center.q-gutter-sm
        //-   q-btn(@click="linkTelegram()" label="Link Telegram" color="primary" flat icon="fa-brands fa-telegram")
        // Telegram linking panel
        .q-mt-lg
          .row.items-center.q-gutter-sm
            h6 Telegram
            q-badge(v-if="tgStatusChecked" :color="tgLinked ? 'positive' : 'warning'" class="q-ml-sm") {{ tgLinked ? (tgTelegramName ? `Connected as ${tgTelegramName}` : 'Connected') : 'Not Connected' }}
          .centered
            small.text-positive If you have Telegram Premium, you'll earn 100 extra Points
          div(v-if="!tgLinked" class="q-mt-sm")
            p.q-mb-sm Connect your Fiddl account to our Telegram bot to receive updates and buy points with Stars.
            .row.q-gutter-sm.items-center
              q-btn(@click="startTgDeepLink()" color="primary" icon="fa-brands fa-telegram" :loading="tgLinking" :disable="tgLinking" label="Connect Telegram")
              q-btn(v-if="deepLink?.deepLink" type="a" :href="deepLink?.deepLink" target="_blank" flat label="Open Telegram")
            div(v-if="tgLinking" class="q-mt-sm")
              q-linear-progress(:value="countdownPct" color="primary" track-color="grey-4")
              small Expires in {{ countdownText }}
          div(v-else class="q-mt-sm")
            p You are connected to Telegram.
          // Stars purchase moved to Add Points page
          // (See AddPointsPage → Telegram Stars toggle)
        // Legacy widget mount (unused)
        .q-mt-sm
          div(ref="telegramLinkMount")
        // QR Code dialog for Telegram linking (desktop)
        q-dialog(v-model="tgQrDialogOpen" :maximized="isMobile")
          q-card(style="width:520px; max-width:100vw;")
            q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
              .row.items-center.justify-between
                h6.q-mt-none.q-mb-none Scan with your phone
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
import { defineComponent } from "vue"
import { userSetBio, userSetNotificationConfig, userSetUsername, privyLinkCurrentUser, telegramLinkStatus, telegramCreateDeepLink, type TelegramCreateDeepLink200 } from "src/lib/orval"
import { useUserAuth } from "src/stores/userAuth"
import PointsTransfer from "src/components/PointsTransfer.vue"
import { copyToClipboard, Dialog, Loading, Notify, useQuasar } from "quasar"
import { catchErr } from "lib/util"
import { avatarImg } from "lib/netlifyImg"
import { handleEmailLogin, verifyEmailCode, authenticateWithTelegram, getPrivyAppConfig } from "src/lib/privy"
import { jwt } from "src/lib/jwt"
import QRCode from "qrcode"

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
  components: { PointsTransfer },
  data() {
    return {
      quasar: useQuasar(),
      editingUsername: false,
      newUsername: "",
      validateUsername,
      avatarImg,
      userBio: "",
      bioEditMode: false,
      telegramLinkMount: null as HTMLElement | null,
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
        void this.checkTgStatus()
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
    async renderTelegramLinkWidget() {
      // Clean old content
      if (this.telegramLinkMount) this.telegramLinkMount.innerHTML = ""
      const cfg = await getPrivyAppConfig()
      console.log("Privy app config:", cfg)
      const botName = "fiddlartbot"
      if (!botName) {
        Notify.create({ message: "Telegram linking not available", color: "negative", icon: "error" })
        return false
      }
      const s = document.createElement("script")
      s.async = true
      s.src = "https://telegram.org/js/telegram-widget.js?22"
      s.setAttribute("data-telegram-login", botName)
      s.setAttribute("data-size", "large")
      // Send Telegram auth result to our SPA callback route where we will link the account
      const redirectUri = `${window.location.origin}/auth/callback?mode=link&provider=telegram`
      s.setAttribute("data-auth-url", redirectUri)
      s.setAttribute("data-request-access", "write")
      this.telegramLinkMount?.appendChild(s)
      return true
    },
    async linkTelegram() {
      // ensure mount ref
      if (!this.telegramLinkMount) this.telegramLinkMount = (this.$refs.telegramLinkMount as HTMLElement) || null
      await this.renderTelegramLinkWidget()
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
      } catch (err) {
        console.error(err)
        Notify.create({ message: "Failed to update username", color: "negative", icon: "error" })
      }
    },
    async linkPrivyEmail() {
      Dialog.create({
        title: "Link with Privy",
        message: "Enter your email to receive a login code",
        prompt: { model: this.$userAuth.userProfile?.email || "", type: "email" },
        cancel: true,
        persistent: true,
      }).onOk(async (email) => {
        if (!email || String(email).trim() === "") {
          Notify.create({ message: "Please enter a valid email", color: "negative", icon: "error" })
          return
        }
        try {
          Loading.show({ message: "Sending verification code..." })
          await handleEmailLogin(String(email))
          Loading.hide()
          Dialog.create({
            title: "Verification",
            message: `Enter the code sent to ${String(email)}`,
            prompt: { model: "", type: "text" },
            cancel: true,
            persistent: true,
          }).onOk(async (code) => {
            try {
              Loading.show({ message: "Linking your account..." })
              const result = await verifyEmailCode(String(email), String(code))
              if (!result.token) throw new Error("No Privy token")
              const linkRes = await privyLinkCurrentUser({ accessToken: result.token })
              const { token: appToken, userId } = linkRes.data
              jwt.save({ userId, token: appToken })
              await this.$userAuth.loadUserData(userId)
              await this.$userAuth.loadUserProfile(userId)
              await this.$userAuth.loadUpvotesWallet()
              Loading.hide()
              Notify.create({ message: "Email linked successfully", color: "positive", icon: "check" })
            } catch (e: any) {
              Loading.hide()
              catchErr(e)
            }
          })
        } catch (err: any) {
          Loading.hide()
          catchErr(err)
          // Notify.create({ message: "Failed to send code: " + err.message, color: "negative", icon: "error" })
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
