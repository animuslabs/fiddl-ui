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
import { telegramCreateDeepLink, telegramLinkStatus, type TelegramCreateDeepLink200 } from "src/lib/orval"
import QRCode from "qrcode"

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
      deepLink: null as TelegramCreateDeepLink200 | null,
      countdown: 0 as number,
      countdownTotal: 0 as number,
      countdownTimer: null as any,
      pollTimer: null as any,
      qrDialogOpen: false as boolean,
      qrDataUrl: "" as string,
      qrLoading: false as boolean,
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

        // For 'link' mode, poll server until linked
        if (this.mode === "link") {
          this.startPolling()
        } else {
          // In login mode, the bot will send a login link back to the app (e.g., /tg-login?t=...)
          // We can't reliably poll for login, so show instructions and let the redirect handle completion.
          Notify.create({ color: "info", message: "Open Telegram and follow the bot to receive your login link" })
        }
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
  },
})
</script>
