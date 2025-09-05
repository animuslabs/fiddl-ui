<template lang="pug">
q-page.flex.flex-center
  .column.items-center.q-gutter-md
    q-spinner(size="32px" color="primary" v-if="processing")
    h5(v-if="processing") Finishing login…
    div(v-else)
      h5 {{ message }}
      q-btn(color="primary" label="Go to Settings" @click="$router.push('/settings')")
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { jwt } from "src/lib/jwt"
import { useUserAuth } from "src/stores/userAuth"

function parseJwt(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default defineComponent({
  name: "TgLogin",
  setup() {
    const route = useRoute()
    const router = useRouter()
    const userAuth = useUserAuth()
    const processing = ref(true)
    const message = ref("")

    onMounted(async () => {
      const t = (route.query.t as string) || ""
      if (!t) {
        processing.value = false
        message.value = "Missing token in URL."
        return
      }

      // Try to extract userId from JWT claims
      const claims = parseJwt(t)
      const userId = claims?.sub || claims?.userId || claims?.uid || null

      try {
        if (!userId) throw new Error("Invalid token payload")
        jwt.save({ userId, token: t })
        // Update auth store to reflect login
        userAuth.setUserId(userId)
        userAuth.loggedIn = true
        await userAuth.loadUserData(userId)
        await userAuth.loadUserProfile(userId)
        await userAuth.loadUpvotesWallet()
        await userAuth.loadNotificationConfig(userId)
        void router.replace("/settings")
      } catch (e) {
        // As a fallback, save token without userId (won't fully log in)
        try {
          if (userId) jwt.save({ userId, token: t })
        } catch {}
        processing.value = false
        message.value = "Login failed. Please try again from Telegram."
      }
    })

    return { processing, message }
  },
})
</script>

<style scoped></style>
