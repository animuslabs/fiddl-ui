<template lang="pug">
//- .centered
//-   q-btn(label="test" @click="liveStore.test(liveStore.sessionId)" v-if="liveStore.sessionId")
.centered.q-mt-md
  .col(style="max-width:500px; min-width:200px;")
    .centered.items-center.q-gutter-sm
      h3 Transcription
      .col-auto
        q-btn(round flat icon="interpreter_mode" color="grey-7" size="sm" :loading="liveStore.loadingSpeakerNames" @click="liveStore.loadSpeakerNames()" :disable="liveStore.transcript.length === 0").text-primary
          q-tooltip
            p Auto Speaker Names
        q-btn(round flat icon="edit" color="grey-7" size="sm" :loading="liveStore.loadingSpeakerNames" @click="liveStore.setSpeakerNames()" :disable="liveStore.transcript.length === 0").text-primary
          q-tooltip
            p Manual Speaker Names
    q-scroll-area(style="height:65vh; width:500px;" ref="scrollArea" ).full-width
      LiveSessionLines(:sessionLines="liveStore.transcript" :speakerNames="liveStore.speakerNames" @seekTime="seekTime" ).full-width
    .row.justify-end.items-start
      .col
        q-toggle(v-model="autoScroll" label="auto scroll" :disable="disableScrollBtns" color="accent")
      q-btn.icon.rounded.outline(flat round @click="scrollTranscription(1)" icon="arrow_downward" size="md" :disable="disableScrollBtns" )
      q-btn.icon.rounded.outline(flat round @click="scrollTranscription(0)" icon="arrow_upward" size="md" :disable="disableScrollBtns")
  q-separator.gt-sm(vertical size="2px")
  .col-auto
    div(style="min-width:300px;")
      .centered.items-center.q-gutter-sm
        h5 ({{ liveStore.prompts.length }})
        h3 Prompts
          q-btn(flat round @click="liveStore.setShowAllCards(false)" icon="sym_o_expand_less" size="sm" color="grey-7" :disable="disablePromptBtns")
            q-tooltip
              p Hide all
          q-btn(flat round @click="liveStore.setShowAllCards(true)" icon="sym_o_expand_more" size="sm" color="grey-7" :disable="disablePromptBtns")
            q-tooltip
              p Show all
    q-scroll-area(style="height:65vh; width:500px;" ref="scrollArea2")
      .centered
        q-list.full-width
          LivePromptCard.q-ma-md(
            :ref="prompt.id"
            v-for="prompt,index in liveStore.prompts"
            style="max-width:640px;"
            :livePrompt="prompt"
            :key="prompt.id"
            :index="index"
            :showAllCards="liveStore.showAllCards"
            :lockHidden="liveStore.transcript.length === 0"
            @refreshPrompts="liveStore.loadPrompts()"
            )
    .row.justify-around
      .col
        q-toggle(v-model="autoUpdatePrompts" label="auto update prompts" v-if="liveStore.capturing || liveStore.transcript.length == 0" color="accent")
      .col-auto
        q-btn(label="add prompt" @click="addPrompt()" rounded flat color="primary" icon="add" :disable="disableAddPrompt").text-white.bg-accent
          q-tooltip(v-if="liveStore.prompts.length >= 10")
            p Maximum Prompts Reached, delete one first


</template>

<script lang="ts">

import LiveSessionLines from "components/LiveSessionLines.vue"
import { api } from "lib/api"
import { TranscriptLine } from "lib/types"
import { QScrollArea } from "quasar"
import LivePromptCard from "src/components/LivePromptCard.vue"
import { useLiveStore } from "src/stores/LiveStore"
import { useUserAuth } from "src/stores/userAuth"
import { defineComponent } from "vue"
let promptRefreshInterval:NodeJS.Timeout | undefined
// const val:InstanceType<typeof LiveSessionLines> = new LiveSessionLines()

// val.seekTime
export default defineComponent({
  components: { LiveSessionLines, LivePromptCard },
  emits: ["liveSessionId", "seekTime"],
  data() {
    return {
      liveStore: useLiveStore(),
      userAuth: useUserAuth(),
      autoScroll: true,
      autoUpdatePrompts: true
    }
  },
  async mounted() {
    const scrollArea = this.$refs.scrollArea as QScrollArea
    scrollArea.setScrollPercentage("vertical", 1, 0)
  },
  computed: {
    disablePromptBtns() {
      return this.liveStore.prompts.length === 0 || (this.liveStore.transcript.length === 0 && !this.liveStore.capturing)
    },
    disableAddPrompt() {
      return this.liveStore.prompts.length >= 10
    },
    disableScrollBtns() {
      return this.liveStore.transcript.length === 0
    }
  },
  methods: {
    async startRefreshInterval() {
      if (!this.autoUpdatePrompts || !this.liveStore.capturing) return
      if (promptRefreshInterval) clearTimeout(promptRefreshInterval)
      promptRefreshInterval = setTimeout(async() => {
        await this.liveStore.loadPrompts()
        for (const prompt of this.liveStore.prompts) {
          if (prompt.processing) continue
          if (!this.liveStore.sessionId) return
          const promptCards = this.$refs[prompt.id] as InstanceType<typeof LivePromptCard>[]
          const promptCard = promptCards[0]
          if (!promptCard) return
          console.log("promptCard", promptCard)
          await promptCard.refreshPrompt()
          // await api.livePrompts.refresh(this.liveStore.sessionId, prompt.id)
        }
        if (this.autoUpdatePrompts && this.liveStore.capturing) void this.startRefreshInterval()
      }, 15000)
    },
    async seekTime(val:number) {
      this.$emit("seekTime", val)
    },
    async addPrompt() {
      await this.liveStore.addPrompt()
      const scrollArea = this.$refs.scrollArea2 as QScrollArea
      setTimeout(() => {
        scrollArea.setScrollPercentage("vertical", 0, 300)
      }, 100)
    },
    scrollTranscription(direction:number) {
      const scrollArea = this.$refs.scrollArea as QScrollArea
      scrollArea.setScrollPercentage("vertical", direction, 500)
      this.autoScroll = false
    }
  },
  beforeUnmount() {
    if (promptRefreshInterval) clearTimeout(promptRefreshInterval)
  },
  watch: {
    "liveStore.capturing"(val) {
      if (val) void this.startRefreshInterval()
    },
    autoUpdatePrompts(val) {
      if (val) {
        void this.startRefreshInterval()
      } else {
        if (promptRefreshInterval) clearTimeout(promptRefreshInterval)
      }
    },
    autoScroll() {
      if (this.autoScroll) {
        const scrollArea = this.$refs.scrollArea as QScrollArea
        scrollArea.setScrollPercentage("vertical", 1, 500)
      }
    },
    "liveStore.transcript": {
      handler(newVal:TranscriptLine[], oldVal:TranscriptLine[]) {
        if (!this.autoScroll) return
        if (!newVal || !oldVal) return
        if (newVal.length === oldVal.length) return

        console.log("sessionLines length", newVal.length)
        const scrollArea = this.$refs.scrollArea as QScrollArea
        scrollArea.setScrollPercentage("vertical", 1, 500)
      },
      deep: true
    }
  }
})
</script>
