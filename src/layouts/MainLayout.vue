<template lang="pug">
q-layout(view="lHh Lpr lFf" )
  q-header
    q-toolbar.bg-grey-10
      .row.no-wrap.items-center
        q-tabs
          q-route-tab(href="https://fiddl.art" :target="isTMA ? '_blank' : undefined" :rel="isTMA ? 'noopener' : undefined" no-caps exact).text-white
            .row.no-wrap.cursor-pointer(style="padding-top:5px; padding-bottom:5px;")
              q-icon(name="img:/fiddlLogo.svg" size="35px" style="padding-left:5px;").q-mr-sm
              //- .text-h5(style="font-family: gluten; font-weight: 200; padding-top:4px;") Fiddl.art
          //- q-route-tab(:to="{ name: 'search' }" exact)
          //-   | Search
          q-route-tab(:to="{ name: 'create' }" @mouseenter="prefetch('create')" @touchstart.passive="prefetch('create')").gt-xs.text-white
            | create
          q-route-tab(:to="{ name: 'browse' }" @mouseenter="prefetch('browse')" @touchstart.passive="prefetch('browse')").gt-xs.text-white
            | browse
          q-route-tab(:to="{ name: 'forge' }" @mouseenter="prefetch('forge')" @touchstart.passive="prefetch('forge')").gt-xs.text-white
            | Forge
          q-route-tab(:to="{ name: 'models' }" @mouseenter="prefetch('models')" @touchstart.passive="prefetch('models')").gt-xs.text-white
            | Models
          q-route-tab(:to="{ name: 'missions' }" @mouseenter="prefetch('missions')" @touchstart.passive="prefetch('missions')").gt-xs.text-white
            .relative-position
              | Missions
              q-badge(v-if="hasClaimableMissions" color="primary" floating rounded style="width:8px;height:8px;padding:0")
          q-route-tab(href="https://fiddl.art/blog").gt-xs.text-white
            | Blog
          //- q-route-tab(:to="{ name: 'vote' }")
          //-   | vote
          //- q-route-tab(:to="{ name: 'mint' }")
          //-   | mint
      .row.justify-end.full-width(v-if="!$userAuth.loggedIn")
        q-btn(flat @click="login()" :label="isMobile ? 'login' : 'login / Register'" dense size="xs")
        //- q-separator(color="white" vertical)
        //- q-btn(flat @click="register()" label="register" size="sm")
      .row.justify-end.full-width.items-center.q-gutter-sm(v-else)
        q-btn(rounded padding="6px" dense size="xs" :color="upvotesColor" v-if="$userAuth.upvotesWallet" @click="openUpvoteInfo")
          .row.items-center
            div( style="font-size:14px;" :class="isMobile ? 'q-ml-sm text-caption' : 'q-ml-md'") {{ $userAuth?.upvotesWallet?.remainingToday || 0 }}
            q-img.q-ml-sm.q-mr-sm(
              :src="$userAuth?.upvotesWallet?.remainingToday ? '/upvote-fire.png' : '/upvote-fire-dull.png'"
              :style="{ width: isMobile ? '22px' : '30px', height: isMobile ? '22px' : '30px' }"
              alt="available upvotes" no-spinner)
          q-tooltip
            p Available Upvotes
        q-btn(rounded padding="0px" dense size="xs" :color="pointsColor" v-if="$userAuth.userData" @click="$router.push({ name: 'addPoints' })" )
          .row.items-center
            div( style="font-size:14px;" :class="isMobile ? 'q-ml-sm text-caption' : 'q-ml-md'") {{ $userAuth?.userData?.availablePoints || 0 }}
            q-img.q-ml-sm(
              src="/FiddlPointsLogo-sm.svg"
              :style="{ width: isMobile ? '32px' : '40px', height: isMobile ? '34px' : '40px' }"
              alt="fiddl points logo" no-spinner)
          q-tooltip
            p Add Fiddl Points
        //- q-btn(flat @click="userAuth.logout()" label="logout" size="sm" )
        NotificationsMenu(v-if="$userAuth.loggedIn")
        q-btn(
          round
          dense
          size="xs"
          padding="1px"
          no-spinner
          @click="menu = true"
        )
          q-img(
            slot="icon"
            :src="avatarImg($userAuth.userId || 'avatar')"
            :style="{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px' }"
            alt="avatar"
            placeholder-src="/blankAvatar.webp"
            :key="reloadAvatar"
          )
        q-menu(
          v-if="menu"
          anchor="bottom right"
          self="top right"
          @mouseleave="menu = false"
          @click="menu = false"
        )
          q-list
            q-item(clickable @click="$router.push({ name: 'settings' })" v-close-popup)
              q-item-section
                .row.items-center
                  q-icon(name="settings" size="20px").q-mr-md
                  div Settings
            q-item(clickable @click="navToUserProfile" v-close-popup)
              q-item-section
                .row.items-center
                  q-icon(name="photo_library" size="20px").q-mr-md
                  div My Account
            q-item(clickable @click="$userAuth.logout()" v-close-popup v-if="!isTMA")
              q-item-section
                .row.items-center
                  q-icon(name="logout" size="20px").q-mr-md
                  div  Logout
            q-item(clickable v-if="isTMA" @click="confirmUnlink" v-close-popup)
              q-item-section
                .row.items-center
                  q-icon(name="link_off" size="20px").q-mr-md
                  div Unlink Telegram

  q-dialog(v-model="showUpvoteInfo")
    q-card(style="min-width:320px;max-width:520px")
      q-card-section
        .row.items-center
          q-img(src="/upvote-fire.png" :style="{ width: '28px', height: '28px' }" no-spinner).q-mr-sm
          .text-h6 Your Upvotes
      .q-ma-md
        .row
          p Remaining: {{ $userAuth.upvotesWallet?.remainingToday }} / {{ $userAuth.upvotesWallet?.allowance }}
        .row
          p Resets : {{ new Date($userAuth.upvotesWallet?.resetAt || "").toLocaleString() }}
      q-card-section(v-if="upvoteInfoLoading")
        .row.justify-center.q-my-md
          q-spinner(color="accent" size="32px")
      //- q-card-section(v-else)
      //-   .text-subtitle1
      //-     | {{ upvoteInfo?.remainingToday ?? $userAuth?.upvotesWallet?.remainingToday || 0 }} upvotes left today
      //-   .text-caption.text-grey-7
      //-     | Refresh {{ upvoteInfo?.resetInText }} (at {{ upvoteInfo?.resetAtLocal }})
      //-   .q-mt-md
      //-     .text-body2
      //-       | Use all your upvotes every day for a week to earn
      //-       b 100 points
      //-   .q-mt-sm
      //-     q-linear-progress(:value="(upvoteInfo?.week?.streak || 0) / 7" color="accent" track-color="grey-4" rounded)
      //-   .row.justify-between.items-center.q-mt-xs
      //-     .text-caption {{ upvoteInfo?.week?.streak || 0 }}/7 days completed
      //-   .row.q-gutter-xs.q-mt-sm
      //-     div(
      //-       v-for="(done, i) in upvoteInfo?.week?.days || []"
      //-       :key="i"
      //-       :style="{ width: '12px', height: '12px', borderRadius: '50%', background: done ? 'var(--q-color-accent)' : '#ccc' }"
      //-     )
      q-card-actions(align="right")
        q-btn(flat label="Close" v-close-popup)

  q-page-container.centered.bg-transparent
    //- .centered(style="width:100vw; height:100%" )
      //- h4.text-white {{ create.state.req.customModelName }} {{ create.state.req.customModelId}}
    router-view.full-width(style="max-width:1650px;")
    .full-width.q-pa-md
      .centered.items-center.q-gutter-md
        q-btn(type="a" href="https://twitter.com/fiddlart" icon="fa-brands fa-x-twitter" color="primary" flat)
        q-btn(type="a" href="https://www.instagram.com/fiddlart" icon="fa-brands fa-instagram" color="primary" flat)
        q-btn(type="a" href="https://www.facebook.com/fiddlart" icon="fa-brands fa-facebook" color="primary" flat)
        q-btn(type="a" href="https://www.linkedin.com/company/fiddl-art" icon="fa-brands fa-linkedin" color="primary" flat)
        q-btn(type="a" href="https://t.me/fiddlart" icon="fa-brands fa-telegram" color="primary" flat)
      .row.justify-center.q-mt-sm
        a(href="https://fiddl.art/privacy-policy" class="text-caption text-grey-5 q-mx-xs" target="_blank" rel="noopener") Privacy Policy
        span.text-grey-7 •
        a(href="https://fiddl.art/terms-of-service" class="text-caption text-grey-5 q-mx-xs" target="_blank" rel="noopener") Terms of Service




  q-footer.lt-lg(color="black").bg-grey-10
    q-tabs(color="black").lt-sm
      q-route-tab(:to="{ name: 'create' }" @mouseenter="prefetch('create')" @touchstart.passive="prefetch('create')").text-white
        | create
      q-route-tab(:to="{ name: 'browse' }" @mouseenter="prefetch('browse')" @touchstart.passive="prefetch('browse')").text-white
        | browse
      q-route-tab(:to="{ name: 'forge' }" @mouseenter="prefetch('forge')" @touchstart.passive="prefetch('forge')").text-white
        |  Forge
      q-route-tab(:to="{ name: 'missions' }" @mouseenter="prefetch('missions')" @touchstart.passive="prefetch('missions')").text-white
        .relative-position
          | Missions
          q-badge(v-if="hasClaimableMissions" color="primary" floating rounded style="width:8px;height:8px;padding:0")
      q-route-tab(href="https://fiddl.art/blog").text-white
        | Blog
</template>

<script lang="ts">
import { Dialog } from "quasar"
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import LoginDialog from "src/components/dialogs/LoginRegister.vue"
import { avatarImg } from "lib/netlifyImg"
import reloadAvatar from "lib/reloadAvatar"
// import RegisterDialog from "components/dialogs/Register.vue"
import { useCreateImageStore } from "stores/createImageStore"
import NotificationsMenu from "src/components/NotificationsMenu.vue"
import { useMissionsStore } from "stores/missionsStore"
import { telegramUnlink } from "lib/orval"
import { prefetchRoute } from "src/lib/routePreloader"

export default defineComponent({
  components: { NotificationsMenu },
  data() {
    return {
      create: useCreateImageStore(),
      menu: false,
      avatarImg,
      reloadAvatar,
      showUpvoteInfo: false,
      upvoteInfoLoading: false,
      upvoteInfo: null,
      missionsStore: useMissionsStore(),
    }
  },
  computed: {
    isTMA(): boolean {
      try {
        if (typeof window === "undefined") return false
        // Only rely on our explicit TMA flag/class set by boot/tma.ts.
        // The Telegram WebApp SDK may define window.Telegram.WebApp even outside Telegram,
        // so checking its mere presence can cause false positives on mobile browsers.
        return Boolean(
          (window as any)?.__TMA__?.enabled ||
            document.documentElement.classList.contains("tma-mode")
        )
      } catch {
        return false
      }
    },
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return window.matchMedia("(max-width: 1023px)").matches
    },
    pointsColor() {
      if (!this.$userAuth.userData) return "negative"
      return this.$userAuth.userData?.availablePoints > 10 ? "grey-9" : "accent"
    },
    upvotesColor() {
      if (!this.$userAuth.upvotesWallet) return "negative"
      return this.$userAuth.upvotesWallet.remainingToday > 0 ? "grey-9" : "accent"
    },
    hasClaimableMissions(): boolean {
      try {
        return this.missionsStore.claimableMissions.length > 0
      } catch {
        return false
      }
    },
  },
  methods: {
    prefetch(name: string) {
      try {
        void prefetchRoute(this.$router, { name })
      } catch {}
    },
    confirmUnlink() {
      Dialog.create({
        title: "Unlink Telegram?",
        message:
          "unlink this fiddl account from your telegram account? You will lose access to this fiddl account, to link to another account, use the /settings page on the web to link your telegram account",
        cancel: { flat: true, label: "Cancel" },
        ok: { flat: true, color: "negative", label: "Unlink" },
      }).onOk(async () => {
        try {
          await telegramUnlink()
        } catch (e) {
          console.error("unlink failed", e)
        } finally {
          try {
            // Close the Telegram Mini App
            const w: any = window as any
            if (w?.Telegram?.WebApp?.close) w.Telegram.WebApp.close()
            else window.close()
          } catch {}
        }
      })
    },
    async navToUserProfile() {
      if (!this.$userAuth.userProfile) await this.$userAuth.loadUserProfile()
      void this.$router.push({ name: "profile", params: { username: this.$userAuth.userProfile?.username } })
    },
    login() {
      void this.$router.push({ name: "login" })
    },
    openUpvoteInfo() {
      this.showUpvoteInfo = true
      void this.loadUpvoteInfo()
    },
    async loadUpvoteInfo() {
      // this.upvoteInfoLoading = true
      // try {
      //   const info = await this.mockFetchUpvoteInfo()
      //   this.upvoteInfo = info
      // } finally {
      //   this.upvoteInfoLoading = false
      // }
    },
    async mockFetchUpvoteInfo() {
      const wallet = this.$userAuth?.upvotesWallet
      const remainingToday = wallet?.remainingToday ?? 0
      const resetAtIso =
        wallet?.resetAt ||
        (() => {
          const d = new Date()
          d.setHours(24, 0, 0, 0)
          return d.toISOString()
        })()
      const ms = new Date(resetAtIso).getTime() - Date.now()
      const hrs = ms > 0 ? Math.floor(ms / 3600000) : 0
      const mins = ms > 0 ? Math.floor((ms % 3600000) / 60000) : 0
      const resetInText = ms > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : "soon"
      const resetAtLocal = new Date(resetAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const week = this.getUpdatedWeekProgress(remainingToday)
      const rewardPoints = 100
      await new Promise((r) => setTimeout(r, 400))
      return { remainingToday, resetAtIso, resetInText, resetAtLocal, week, rewardPoints }
    },
    getUpdatedWeekProgress(remainingToday: number) {
      try {
        const key = "fiddl:upvoteWeek"
        const today = new Date()
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
        let stateRaw = localStorage.getItem(key)
        let state = stateRaw ? JSON.parse(stateRaw) : null
        if (!state || typeof state.start !== "number" || !Array.isArray(state.days)) {
          state = { start: todayStart, days: new Array(7).fill(false) }
        }
        const dayIndex = Math.floor((todayStart - state.start) / 86400000)
        if (dayIndex < 0 || dayIndex >= 7) {
          state = { start: todayStart, days: new Array(7).fill(false) }
        }
        const idx = Math.max(0, Math.min(6, Math.floor((todayStart - state.start) / 86400000)))
        if (remainingToday <= 0) state.days[idx] = true
        const streak = state.days.filter((d: boolean) => d).length
        localStorage.setItem(key, JSON.stringify(state))
        return { days: state.days, streak }
      } catch {
        return { days: new Array(7).fill(false), streak: 0 }
      }
    },
  },
})
</script>
