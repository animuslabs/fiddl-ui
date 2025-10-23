<template lang="pug">
//- div.bg-black(style="position:fixed").full-width.full-height.z-max
//- ImageGallery(:images="images" ref="gallery" hidden  )

.z-index-wrap(style="z-index:1")
  router-view
.z-top
  ReferralSurveyDialog(v-model="showReferralSurvey" :user-id="$userAuth.userId" @submitted="onReferralSubmitted")
  MotdDialog
.bg-grid-overlay
.bg-color-base
</template>

<style lang="sass">
.bg-color-base
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-color: rgb(18,18,18)
  z-index: -1

.bg-grid-overlay
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-image: url('/bg-grain.png')
  background-size: 128px
  background-repeat: repeat
  opacity: 0.05
  pointer-events: none
  z-index: 0
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { Dialog, LocalStorage, Notify, SessionStorage } from "quasar"
import ImageGallery from "src/components/dialogs/MediaViewer.vue"
import ReferralSurveyDialog from "src/components/dialogs/ReferralSurvey.vue"
import MotdDialog from "src/components/dialogs/MotdDialog.vue"
import { shortIdToLong, toObject } from "lib/util"
import { usePricesStore } from "src/stores/pricesStore"
import { tawk } from "lib/tawk"
import { promoClaimPromoCode, marketingHowFoundStatus } from "lib/orval"
import { handleClaimCode } from "lib/promoCodeUtil"
import { useMissionsStore } from "stores/missionsStore"
import { useAsyncErrorStore } from "stores/asyncErrorStore"
import { useMotdStore } from "stores/motdStore"
// LoadingBar.setDefaults({
//   color: "transparent",
//   size: "1px",
//   position: "top",
//   reverse: false,
// })
// import { useCreateImageStore } from "stores/createImageStore"
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    setTimeout(() => {
      console.clear()
    }, 10)
  })
}
// const createStore = useCreateImageStore()
export default defineComponent({
  name: "App",
  components: {
    ImageGallery,
    ReferralSurveyDialog,
    MotdDialog,
  },
  data() {
    return {
      images: [] as string[],
      // req: createStore.state.req,
      showReferralSurvey: false as boolean,
      referralSurveyChecking: false as boolean,
      motd: useMotdStore(),
      motdSuppressed: false as boolean,
      motdAllowedRoutes: ["index", "browse", "create", "forge"] as string[],
    }
  },
  computed: {
    isMotdAllowedRoute(): boolean {
      const name = this.$route?.name
      if (!name) return false
      return this.motdAllowedRoutes.includes(String(name))
    },
  },
  watch: {
    "$route.query": {
      immediate: true,
      handler(newQuery) {
        const referredBy = this.$route.query?.referredBy as string | undefined
        if (referredBy) LocalStorage.set("referredBy", referredBy)
      },
    },
    // If user navigates away from magic mirror pages, re-check to show notification
    "$route.name": {
      handler() {
        // Only attempt if user is logged in; respects session one-time key
        if (this.$userAuth?.loggedIn) this.maybeNotifyClaimables()
        this.handleMotdRouteChange(this.isMotdAllowedRoute)
      },
    },
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val: boolean) {
        const missions = useMissionsStore()
        const asyncErrors = useAsyncErrorStore()
        if (val) {
          missions.startPolling()
          // Initial check for claimables after login
          this.maybeNotifyClaimables()
          // Check if we should prompt referral survey on login
          this.$nextTick(() => this.maybeShowReferralSurvey())
          asyncErrors.startPolling()
          void this.motd.refreshLatest()
          this.motd.startPolling()
          this.handleMotdRouteChange(this.isMotdAllowedRoute)
        } else {
          missions.stopPolling()
          asyncErrors.stopPolling()
          this.motd.stopPolling()
          this.motd.closeDialog(false)
          this.motdSuppressed = false
        }
      },
    },
    // Also re-check when profile loads/updates so we have createdAt
    "$userAuth.userProfile": {
      deep: false,
      handler() {
        this.maybeShowReferralSurvey()
      },
    },
    isMotdAllowedRoute: {
      immediate: true,
      handler(val: boolean) {
        this.handleMotdRouteChange(val)
      },
    },
    "motd.dialogVisible"(visible: boolean) {
      if (visible && !this.isMotdAllowedRoute && !this.motd.dialogBypassGuard) {
        this.motdSuppressed = true
        this.motd.dialogVisible = false
        this.motd.clearDialogBypass()
      } else if (!visible && this.motd.dialogBypassGuard) {
        this.motd.clearDialogBypass()
      }
    },
    "motd.latest": {
      deep: false,
      handler() {
        if (this.isMotdAllowedRoute) this.maybeRestoreMotdDialog()
      },
    },
  },
  created() {
    // this.$userAuth = useUserAuth()
    // console.log(this.$route.query)
  },

  async mounted() {
    void usePricesStore().reloadPrices().catch(console.error)
    // In Telegram Mini App mode, do not restore a previous login
    const inTMA = typeof window !== "undefined" && ((window as any).__TMA__?.enabled || document.documentElement.classList.contains("tma-mode"))
    if (!inTMA) {
      await this.$userAuth.attemptAutoLogin()
    }
    await handleClaimCode(this.$userAuth.loggedIn)

    // Watch for claimable missions and notify once per session
    const missions = useMissionsStore()
    this.$watch(
      () => missions.claimableMissions.length,
      (len) => {
        if (len > 0) this.maybeNotifyClaimables()
      },
      { immediate: true },
    )
  },
  methods: {
    async maybeShowReferralSurvey() {
      try {
        if (!this.$userAuth?.loggedIn) return
        const uid = this.$userAuth.userId
        if (!uid) return
        // Do not show if already completed
        if (LocalStorage.getItem(`referralSurveyCompleted:${uid}`)) return
        // Check server status once in case completed on another device
        if (!this.referralSurveyChecking) {
          this.referralSurveyChecking = true
          try {
            const { data: status } = await marketingHowFoundStatus()
            if (status?.set) {
              const choiceEnum = status.surveyResult || undefined
              const sourceRaw = (status as any)?.source as string | null
              const otherFromStatus = status.surveyResultOther || undefined
              const allowed = ["reddit", "facebook", "instagram", "tiktok", "twitter", "youtube", "search", "friend", "blog", "discord", "newsletter", "other"]
              let choice = choiceEnum || undefined
              let otherText = otherFromStatus || undefined
              if (!choice) {
                const src = sourceRaw || undefined
                if (src && allowed.includes(src)) choice = src as any
                else if (src && !otherText) {
                  choice = "other"
                  otherText = src
                }
              }
              LocalStorage.set(`referralSurveyCompleted:${uid}`, true)
              LocalStorage.set(`referralSurveyAnswer:${uid}`, { choice: choice || (otherText ? "other" : undefined), otherText })
              this.referralSurveyChecking = false
              return
            }
          } catch {
            // ignore and fall through to showing the survey
          } finally {
            this.referralSurveyChecking = false
          }
        }
        // Guard against multiple opens
        if (this.showReferralSurvey) return
        this.showReferralSurvey = true
      } catch {}
    },
    onReferralSubmitted(payload: { choice: string; otherText?: string }) {
      // Placeholder for future API call hookup
      // console.log('Referral survey submitted', payload)
    },
    maybeNotifyClaimables() {
      if (this.$route.name === "missions") return
      if (this.$route.name === "magicMirror") return
      if (this.$route.name === "magicMirrorBanana") return
      const KEY = "missions-claimable-notified"
      if (SessionStorage.getItem(KEY)) return
      const missions = useMissionsStore()
      if (missions.claimableMissions.length === 0) return
      SessionStorage.set(KEY, true)
      Dialog.create({
        title: "Missions",
        message: "You have one or more claimable missions.",
        ok: { label: "View Missions", color: "primary", flat: false },
        cancel: { label: "Later", flat: true },
      }).onOk(() => {
        this.$router.push({ name: "missions" }).catch(() => {})
      })
    },
    handleMotdRouteChange(isAllowed: boolean) {
      if (!this.$userAuth?.loggedIn) return
      if (!this.motd.hasMessage) return
      if (isAllowed) {
        if (this.motdSuppressed) this.maybeRestoreMotdDialog()
      } else if (this.motd.dialogVisible && !this.motd.dialogBypassGuard) {
        this.motdSuppressed = true
        this.motd.dialogVisible = false
        this.motd.clearDialogBypass()
      } else if (!isAllowed) {
        this.motdSuppressed = !this.motd.dialogBypassGuard
      }
    },
    maybeRestoreMotdDialog() {
      const current = this.motd.latest
      if (!current) {
        this.motdSuppressed = false
        return
      }
      if (this.motd.isAcknowledged?.(current.id) || current.readAt) {
        this.motdSuppressed = false
        return
      }
      if (!this.motd.dialogVisible && this.isMotdAllowedRoute) {
        this.motd.showDialog()
      }
      this.motdSuppressed = false
    },
    openDialog(startingIndex = 0, images: string[]) {
      this.images = toObject(images)
      const gallery = this.$refs.gallery as InstanceType<typeof ImageGallery>
      console.log(gallery)
      gallery.show()
      // gallery.openDialog(startingIndex)
    },
  },
})
</script>
