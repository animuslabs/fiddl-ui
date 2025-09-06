<template lang="pug">
div
  // Action row
  .row.items-center.q-gutter-sm
    q-btn(
      @click="start"
      color="primary"
      icon="fa-brands fa-telegram"
      :round="round"
      :loading="linking"
      :disable="linking"
      :label="computedButtonLabel"
      :padding="round?'12px':''"
    )
    q-btn(
      v-if="deepLink?.deepLink"
      type="a"
      :href="deepLink?.deepLink"
      target="_blank"
      flat
      label="Open Telegram"
    )
  // Progress / countdown
  div(v-if="linking" class="q-mt-sm")
    q-linear-progress(:value="countdownPct" color="primary" track-color="grey-4")
    small Expires in {{ countdownText }}
    div(v-if="mode === 'login'" class="q-mt-sm")
      p.text-grey-8 Enter the code shown in Telegram to approve this login
      .row.items-center.q-gutter-sm
        q-input(
          dense
          filled
          type="tel"
          inputmode="numeric"
          :maxlength="6"
          v-model="codeInput"
          style="width:160px"
          label="Code"
          @keyup.enter="verifyCode"
        )
        q-btn(
          color="primary"
          label="Verify"
          :loading="verifying"
          :disable="verifying || codeInput.length < 5"
          @click="verifyCode"
        )
      small(v-if="statusText") {{ statusText }}
  // Desktop QR dialog
  q-dialog(v-model="qrDialogOpen" :maximized="isMobile")
    q-card(style="width:520px; max-width:100vw;")
      q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
        .row.items-center.justify-between
          h6.q-mt-none.q-mb-none Scan with your phone to continue in Telegram
          q-btn(flat dense round icon="close" v-close-popup)
      q-separator
      q-card-section
        .centered
          q-spinner(v-if="qrLoading || !qrDataUrl" color="primary" size="120px")
          q-img(v-else :src="qrDataUrl" style="width:min(92vw, 600px); height:auto;" no-spinner)
        .centered.q-mt-md
          q-btn(
            v-if="deepLink?.deepLink"
            type="a"
            :href="deepLink?.deepLink"
            target="_blank"
            color="primary"
            icon="fa-brands fa-telegram"
            label="Open Telegram on this device"
            rounded
          )
          q-btn(color="grey-7" icon="close" label="Close" flat rounded v-close-popup).q-ml-sm
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useQuasar, Notify } from "quasar"
import { telegramCreateDeepLink, telegramLinkStatus, telegramCreateDeviceLogin, telegramExchangeDeviceLogin, type TelegramCreateDeepLink200, type TelegramCreateDeviceLogin200 } from "src/lib/orval"
import QRCode from "qrcode"
import { useUserAuth } from "src/stores/userAuth"
import { jwt } from "src/lib/jwt"

export default defineComponent({
  name: "TelegramConnect",
  props: {
    round: {
      type: Boolean,
      default: false,
    },
    mode: {
      type: String,
      default: "link", // 'link' | 'login'
      validator: (v: string) => v === "link" || v === "login",
    },
    autoStart: {
      type: Boolean,
      default: false,
    },
    buttonLabel: {
      type: String,
      default: "",
    },
  },
  emits: ["started", "linked", "error"],
  data() {
    return {
      $q: useQuasar(),
      linking: false as boolean,
      deepLink: null as (TelegramCreateDeepLink200 | TelegramCreateDeviceLogin200) | null,
      countdown: 0 as number,
      countdownTotal: 0 as number,
      countdownTimer: null as any,
      pollTimer: null as any,
      qrDialogOpen: false as boolean,
      qrDataUrl: "" as string,
      qrLoading: false as boolean,
      deviceLoginId: "" as string,
      clientNonce: "" as string,
      codeInput: "" as string,
      verifying: false as boolean,
      statusText: "" as string,
      expiresAtMs: 0 as number,
      userAuth: useUserAuth(),
      autoVerifyTimer: null as any,
    }
  },
  computed: {
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return this.$q.screen.lt.md
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
    computedButtonLabel(): string {
      if (this.round) return ""
      if (this.buttonLabel && this.buttonLabel.trim().length > 0) return this.buttonLabel
      return this.mode === "login" ? "Login with Telegram" : "Connect Telegram"
    },
  },
  watch: {
    autoStart: {
      immediate: true,
      handler(val: boolean) {
        if (val) void this.start()
      },
    },
    codeInput(val: string) {
      // digits-only, max 6
      const digits = String(val || "").replace(/\D/g, "").slice(0, 6)
      if (digits !== val) {
        this.codeInput = digits
        return
      }
      // Auto-verify when we have enough digits
      if (this.mode === "login") {
        if (this.autoVerifyTimer) clearTimeout(this.autoVerifyTimer)
        if (digits.length >= 5) {
          this.autoVerifyTimer = setTimeout(() => {
            if (!this.verifying && digits === this.codeInput) this.verifyCode()
          }, 150)
        }
      }
    },
  },
  mounted() {
    this.restoreDeviceLogin()
  },
  beforeUnmount() {
    if (this.countdownTimer) clearInterval(this.countdownTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
  },
  methods: {
    async start() {
      if (this.linking) return
      this.linking = true
      try {
        if (this.mode === "login") {
          await this.startDeviceLogin()
          this.$emit("started", this.deepLink)
          return
        }
        const { data } = await telegramCreateDeepLink({})
        this.deepLink = data
        this.countdownTotal = data.expiresIn
        this.countdown = data.expiresIn
        this.startCountdown()

        if (data.deepLink) {
          try {
            if (this.isMobile) {
              window.open(data.deepLink, "_blank")
            } else {
              await this.openQr()
            }
          } catch {}
        }

        this.startPolling()
        this.$emit("started", data)
      } catch (e: any) {
        this.linking = false
        this.$emit("error", e)
        Notify.create({ color: "negative", message: e?.message || "Failed to start Telegram flow" })
      }
    },
    startCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer)
      this.countdownTimer = setInterval(() => {
        this.countdown = Math.max(0, this.countdown - 1)
        if (this.countdown <= 0) {
          clearInterval(this.countdownTimer)
          if (this.mode === "login") this.clearDeviceLoginStorage()
          this.linking = false
          this.qrDialogOpen = false
        }
      }, 1000)
    },
    startPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = setInterval(async () => {
        try {
          const { data } = await telegramLinkStatus()
          if (data.linked || (data?.data as any)?.telegramId) {
            if (this.pollTimer) clearInterval(this.pollTimer)
            this.pollTimer = null
            if (this.countdownTimer) clearInterval(this.countdownTimer)
            this.linking = false
            this.qrDialogOpen = false
            const extra = data?.data as any
            const telegramId = extra?.telegramId || null
            const telegramName = extra?.telegramName || null
            this.$emit("linked", { telegramId, telegramName })
          }
        } catch {
          // ignore transient
        }
        if (this.countdown <= 0) {
          if (this.pollTimer) clearInterval(this.pollTimer)
          this.pollTimer = null
        }
      }, 2000)
    },
    async openQr() {
      if (!this.deepLink?.deepLink) return
      this.qrDialogOpen = true
      this.qrLoading = true
      try {
        this.qrDataUrl = await QRCode.toDataURL(this.deepLink.deepLink, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 1024,
          color: { dark: "#000000", light: "#ffffff" },
        })
      } catch {
      } finally {
        this.qrLoading = false
      }
    },

    async startDeviceLogin() {
      try {
        const { data } = await telegramCreateDeviceLogin({})
        this.deepLink = data
        this.deviceLoginId = data.id
        this.clientNonce = data.clientNonce
        this.countdownTotal = data.expiresIn
        this.countdown = data.expiresIn
        this.expiresAtMs = Date.now() + data.expiresIn * 1000
        sessionStorage.setItem("tgDeviceLinkId", this.deviceLoginId)
        sessionStorage.setItem("tgDeviceClientNonce", this.clientNonce)
        sessionStorage.setItem("tgDeviceExpiresAt", String(this.expiresAtMs))
        this.startCountdown()
        if (data.deepLink) {
          try {
            if (this.isMobile) {
              window.open(data.deepLink, "_blank")
            } else {
              await this.openQr()
            }
          } catch {}
        }
        this.statusText = "Waiting for code…"
      } catch (e: any) {
        this.linking = false
        this.$emit("error", e)
        Notify.create({ color: "negative", message: e?.message || "Failed to start Telegram device login" })
      }
    },

    async verifyCode() {
      const code = String(this.codeInput || "").trim()
      if (!/^\d{5,6}$/.test(code)) {
        Notify.create({ color: "warning", message: "Enter the code from Telegram" })
        return
      }
      const id = this.deviceLoginId || sessionStorage.getItem("tgDeviceLinkId") || ""
      const clientNonce = this.clientNonce || sessionStorage.getItem("tgDeviceClientNonce") || ""
      if (!id || !clientNonce) {
        this.linking = false
        this.statusText = "Invalid state. Please try again."
        Notify.create({ color: "negative", message: "Login state missing. Please start again." })
        return
      }
      this.deviceLoginId = id
      this.clientNonce = clientNonce

      this.verifying = true
      this.statusText = "Verifying…"
      try {
        const res = await telegramExchangeDeviceLogin({ id, clientNonce })
        const { token, userId } = res.data
        await this.applyLoginToken(token, userId)
        this.clearDeviceLoginStorage()
        this.linking = false
        this.qrDialogOpen = false
        this.statusText = "Approved! Signing you in…"
        Notify.create({ color: "positive", message: "Logged in via Telegram" })
      } catch (err: any) {
        const msg = String(err?.response?.data?.message || err?.message || "")
        if (/Not approved yet/i.test(msg)) {
          this.statusText = "Not approved yet — checking…"
          this.startExchangePolling()
        } else if (/expired|invalid/i.test(msg)) {
          this.statusText = "Expired. Try again."
          this.clearDeviceLoginStorage()
          this.linking = false
          this.qrDialogOpen = false
          Notify.create({ color: "warning", message: "Login link expired. Please try again." })
        } else {
          this.statusText = "Waiting for approval…"
          Notify.create({ color: "info", message: "Waiting for Telegram approval…" })
          this.startExchangePolling()
        }
      } finally {
        this.verifying = false
      }
    },

    startExchangePolling() {
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = setInterval(async () => {
        if (this.countdown <= 0 || (this.expiresAtMs && Date.now() >= this.expiresAtMs)) {
          if (this.pollTimer) clearInterval(this.pollTimer)
          this.pollTimer = null
          this.linking = false
          this.qrDialogOpen = false
          this.clearDeviceLoginStorage()
          return
        }
        try {
          const id = this.deviceLoginId || sessionStorage.getItem("tgDeviceLinkId") || ""
          const clientNonce = this.clientNonce || sessionStorage.getItem("tgDeviceClientNonce") || ""
          if (!id || !clientNonce) return
          const res = await telegramExchangeDeviceLogin({ id, clientNonce })
          const { token, userId } = res.data
          if (this.pollTimer) clearInterval(this.pollTimer)
          this.pollTimer = null
          this.statusText = "Approved! Signing you in…"
          await this.applyLoginToken(token, userId)
          this.clearDeviceLoginStorage()
          this.linking = false
          this.qrDialogOpen = false
          Notify.create({ color: "positive", message: "Logged in via Telegram" })
        } catch (err: any) {
          const msg = String(err?.response?.data?.message || err?.message || "")
          if (/Not approved yet/i.test(msg)) {
            // keep polling
          } else if (/expired|invalid/i.test(msg)) {
            if (this.pollTimer) clearInterval(this.pollTimer)
            this.pollTimer = null
            this.statusText = "Expired. Try again."
            this.linking = false
            this.qrDialogOpen = false
            this.clearDeviceLoginStorage()
            Notify.create({ color: "warning", message: "Login link expired. Please try again." })
          } else {
            // transient error, continue polling
          }
        }
      }, 2000)
    },

    async applyLoginToken(token: string, userId: string) {
      try {
        this.userAuth.logout()
      } catch {}
      this.userAuth.setUserId(userId)
      jwt.save({ userId, token })
      this.userAuth.loggedIn = true
      await this.userAuth.loadUserData(userId)
      await this.userAuth.loadUpvotesWallet()
      void this.userAuth.loadUserProfile(userId)
    },

    clearDeviceLoginStorage() {
      try {
        sessionStorage.removeItem("tgDeviceLinkId")
        sessionStorage.removeItem("tgDeviceClientNonce")
        sessionStorage.removeItem("tgDeviceExpiresAt")
      } catch {}
      this.deviceLoginId = ""
      this.clientNonce = ""
      this.codeInput = ""
      this.expiresAtMs = 0
    },

    restoreDeviceLogin() {
      if (this.mode !== "login") return
      try {
        const id = sessionStorage.getItem("tgDeviceLinkId") || ""
        const clientNonce = sessionStorage.getItem("tgDeviceClientNonce") || ""
        const expiresAtStr = sessionStorage.getItem("tgDeviceExpiresAt") || ""
        const expiresAt = Number(expiresAtStr || 0)
        if (id && clientNonce && expiresAt && Date.now() < expiresAt) {
          this.deviceLoginId = id
          this.clientNonce = clientNonce
          this.expiresAtMs = expiresAt
          const secsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
          this.countdownTotal = secsLeft
          this.countdown = secsLeft
          this.linking = true
          this.statusText = "Waiting for code…"
          this.startCountdown()
        } else {
          this.clearDeviceLoginStorage()
        }
      } catch {
        // ignore
      }
    },
  },
})
</script>
