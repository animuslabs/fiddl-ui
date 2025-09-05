<template>
  <div ref="turnstileContainer"></div>
</template>

<script>
import { LocalStorage } from "quasar"

export default {
  name: "Turnstile",
  props: {
    sitekey: {
      type: String,
      required: true,
      default: "0x4AAAAAAAzEFGY3w2GEvxDn",
    },
    theme: {
      type: String,
      default: "dark", // Options: 'light', 'dark', 'auto'
    },
    size: {
      type: String,
      default: "normal", // Options: 'normal', 'compact', 'invisible'
    },
    tabindex: {
      type: Number,
      default: 0,
    },
  },
  emits: ["success", "expired", "error"],
  data() {
    return {
      widgetId: null,
    }
  },
  mounted() {
    this.loadTurnstileScript().then(() => {
      this.renderTurnstile()
    })
  },
  beforeUnmount() {
    this.resetTurnstile()
  },
  methods: {
    loadTurnstileScript() {
      return new Promise((resolve, reject) => {
        if (window.turnstile && typeof window.turnstile.render === "function") {
          console.log("Turnstile script already loaded.")
          resolve()
          return
        }

        const script = document.createElement("script")
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
        script.async = true
        script.defer = true
        script.onload = () => {
          console.log("Turnstile script loaded successfully.")
          resolve()
        }
        script.onerror = (error) => {
          console.error("Turnstile script failed to load.", error)
          reject(new Error("Turnstile script failed to load."))
        }
        document.head.appendChild(script)
      })
    },

    renderTurnstile() {
      if (window.turnstile && this.$refs.turnstileContainer) {
        this.widgetId = window.turnstile.render(this.$refs.turnstileContainer, {
          sitekey: this.sitekey,
          theme: this.theme,
          size: this.size,
          tabindex: this.tabindex,
          callback: this.onSuccess,
          "expired-callback": this.onExpired,
          "error-callback": this.onError,
        })
      }
    },
    onSuccess(token) {
      this.$emit("success", token)
      console.log("Turnstile token:", token)
      LocalStorage.set("turnstileToken", token)
    },
    onExpired() {
      this.$emit("expired")
    },
    onError(err) {
      this.$emit("error")
      console.log("Turnstile error", err)
    },
    resetTurnstile() {
      console.log("reset triggered")
      if (this.widgetId !== null && window.turnstile) {
        window.turnstile.reset(this.widgetId)
      }
    },
  },
}
</script>
