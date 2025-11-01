<template lang="pug">
q-page.flex.flex-center
  q-card.q-pa-xl.q-ma-md(flat bordered style="max-width: 480px; width: 100%;")
    template(v-if="state === 'loading'")
      .column.items-center.q-gutter-md
        q-spinner(color="primary" size="3em")
        div.text-center.text-grey-4 Validating your deletion request…
    template(v-else-if="state === 'success'")
      .column.items-center.q-gutter-md
        q-icon(name="check_circle" color="positive" size="72px")
        h5.text-center Account deleted
        p.text-center We'll redirect you to the home page in a moment.
        q-btn(color="primary" label="Go home now" @click="goHome")
    template(v-else)
      .column.items-center.q-gutter-md
        q-icon(name="error" color="negative" size="72px")
        h5.text-center Confirmation link invalid or expired
        p.text-center We couldn't confirm your deletion request. Ask for a fresh confirmation link to continue.
        q-btn(color="primary" label="Request new link" :loading="retryLoading" @click="requestNewLink" :disable="retryLoading")
        q-btn(flat color="primary" label="Back to settings" @click="goSettings")
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Dialog, Notify, useQuasar } from "quasar"
import { catchErr } from "lib/util"
import { userConfirmDeleteAccount, userRequestDeleteAccount } from "src/lib/orval"
import { useUserAuth } from "src/stores/userAuth"

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineComponent({
  name: "AccountDeletePage",
  setup() {
    const route = useRoute()
    const router = useRouter()
    const quasar = useQuasar()
    const userAuth = useUserAuth()
    const state = ref<"loading" | "success" | "error">("loading")
    const retryLoading = ref(false)

    async function confirmDeletion() {
      const token = typeof route.query.token === "string" ? route.query.token.trim() : ""
      if (!token) {
        state.value = "error"
        Notify.create({ type: "negative", message: "Missing confirmation token. Request a new deletion link." })
        return
      }
      try {
        const { data } = await userConfirmDeleteAccount({ token })
        if (data?.ok) {
          userAuth.logout()
          state.value = "success"
          Notify.create({ type: "positive", message: "Your account has been deleted." })
          window.setTimeout(() => {
            void router.replace({ name: "home" })
          }, 2500)
          return
        }
        state.value = "error"
        Notify.create({ type: "negative", message: "Unable to confirm account deletion. Request a new link." })
      } catch (err) {
        state.value = "error"
        Notify.create({ type: "negative", message: "We couldn't confirm your request. Please request a new link." })
        catchErr(err)
      }
    }

    async function requestNewLink() {
      if (retryLoading.value) return
      Dialog.create({
        title: "Request a new confirmation link",
        message: "We'll resend the confirmation link to your verified contact. Enter an email to force the email channel (optional).",
        prompt: {
          model: "",
          type: "text",
          isValid: (val: string) => {
            const trimmed = String(val || "").trim()
            return trimmed === "" || emailRegex.test(trimmed)
          },
          placeholder: "Email (optional)",
        },
        cancel: true,
        ok: { label: "Send link", color: "primary", flat: true },
        persistent: true,
        maximized: quasar.screen.lt.md,
      }).onOk(async (input) => {
        const trimmed = String(input || "").trim()
        const payload = trimmed ? { email: trimmed } : undefined
        retryLoading.value = true
        try {
          const { data } = await userRequestDeleteAccount(payload)
          if (data?.ok) {
            const channel = data.method === "email" ? "email" : data.method === "telegram" ? "Telegram" : "your verified contact"
            Notify.create({ type: "positive", message: `We sent a new confirmation link via ${channel}.` })
          } else {
            const msg = data?.reason || "Unable to send a new confirmation link."
            Notify.create({ type: "negative", message: msg })
          }
        } catch (err) {
          Notify.create({ type: "negative", message: "We couldn't send a new confirmation link. Please try again later." })
          catchErr(err)
        } finally {
          retryLoading.value = false
        }
      })
    }

    function goHome() {
      void router.replace({ name: "home" })
    }

    function goSettings() {
      void router.replace({ name: "settings" })
    }

    onMounted(() => {
      void confirmDeletion()
    })

    return {
      state,
      retryLoading,
      goHome,
      goSettings,
      requestNewLink,
    }
  },
})
</script>
