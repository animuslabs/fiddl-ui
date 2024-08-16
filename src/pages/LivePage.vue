<template lang="pug">
q-page
  div(v-if="!showDashboard").full-width.q-mt-md
    .centered.q-mb-md
      q-btn(label="Start Live Session" @click="startTranscribeMode()" rounded outline icon="interpreter_mode" icon-right="add" size="16px").text-green.bg-white
  .centered
    ConversationRecorder(v-if="showRecorder" style="width:1200px; max-width:100vw" ref="convRecorder")
  q-separator
  .centered.q-mt-md(v-if="showSessionList")
    LiveSessionsList
  LiveDashboard(v-if="showDashboard" @seekTime="seekTime")
</template>

<script lang="ts">
import { api } from "lib/api"
import { Loading, Notify } from "quasar"
import ConversationRecorder from "src/components/ConversationRecorder.vue"
import LiveDashboard from "src/components/LiveDashboard.vue"
import LiveSessionsList from "src/components/LiveSessionsList.vue"
import { useLiveStore } from "src/stores/LiveStore"
import { useUserAuth } from "src/stores/userAuth"
import { defineComponent } from "vue"

export default defineComponent({
  components: { LiveDashboard, ConversationRecorder, LiveSessionsList },
  data() {
    return {
      userAuth: useUserAuth(),
      liveStore: useLiveStore(),
      showSessionList: false,
      showDashboard: true,
      showRecorder: true
    }
  },
  // async mounted() {

  // },
  computed: {
  },
  methods: {
    async seekTime(val:number) {
      const convRecorder = this.$refs.convRecorder as typeof ConversationRecorder
      convRecorder.seekTime(val)
    },
    async startTranscribeMode(sessionId?:string) {
      if (!sessionId) {
        Loading.show()
        sessionId = await api.liveSession.create()
        Loading.hide()
      }
      this.showRecorder = true
      this.showDashboard = true
      this.showSessionList = false
      void this.$router.push({ name: "live", params: { id: sessionId } })
    },
    startPreviousSessionMode() {
      this.showRecorder = false
      this.showDashboard = true
      this.showSessionList = false
    }

  },
  watch: {
    "$route.params.id": {
      immediate: true,
      handler(urlId:string) {
        if (!urlId || typeof urlId !== "string") {
          this.showRecorder = false
          this.showDashboard = false
          this.showSessionList = true
          void this.liveStore.loadUserLiveSessions()
        } else {
          console.log("urlId", urlId)
          Loading.show()

          void this.liveStore.loadSessionData(urlId, true)
            .then(() => {
              void this.startTranscribeMode(urlId)
              Loading.hide()
            })
            .catch(() => {
              Loading.hide()
              console.log("error loading session data")
              void this.$router.replace({ name: "live", params: { id: null } })
              Notify.create({
                message: "Error loading session data.",
                color: "negative",
                timeout: 2000
              })
            })
        }
      }
    },
    "userAuth.loggedIn": {
      immediate: false,
      handler() {
        if (this.userAuth.loggedIn) {
          void this.liveStore.loadUserLiveSessions()
        }
      }
    },
    liveSessionId() {
      console.log("liveSessionId changed")
      // void this.loadSessionData()
    }
  }
})
</script>
