<template lang="pug">
div.q-pt-md.q-pb-md
  .row.items-center.justify-between.q-mr-md.q-ml-md
    q-btn.q-mr-md(label="Back" @click="$router.push({name:'live', params:{id:null}})" rounded flat icon="arrow_back_ios" size="16px").bg-white
    q-btn.q-mr-md(v-if="!liveStore.capturing && liveStore.transcript.length === 0" label="Start Conversation Capture" @click="startConversationCapture()" rounded flat icon="radio_button_checked" size="16px" :disable="!liveStore.sessionId").bg-accent.text-grey-1
    .centered.full-width(v-else style="max-width:600px;")
      //- h5 hi
      AudioPlayer.full-width( style="max-width:600px;" v-if="liveStore.sessionId && !liveStore.capturing" :sessionId="liveStore.sessionId" ref="audioPlayer")
      q-btn.q-mr-md(v-if="liveStore.capturing" label="Stop Conversation Capture" @click="stopConversationCapture()" rounded flat icon="sym_o_adaptive_audio_mic_off" size="16px" :disable="!liveStore.sessionId").bg-warning.text-grey-1
    q-btn-dropdown.full-width.q-mr-md( v-if="!liveStore.capturing && liveStore.transcript.length === 0" rounded flat icon="settings_voice" size="16px" style="max-width:300px;").bg-white.text-black
      template(v-slot:label)
        p.ellipsis.full-width.q-pl-sm {{ selectedMicName || "Select Mic" }}
      q-list.bg-white
        q-item(v-for="device of convRecorder.micRecorder.devices" clickable v-close-popup @click="convRecorder.micRecorder.selectMic(device)").text-black
          q-item-section(avatar)
            q-icon(name="mic" color="black" v-if="convRecorder.micRecorder.selectedMicData?.deviceId === device.deviceId")
          q-item-section
            q-item-label {{device.label}}
    div(v-if="nameLength < 30")
      h5 {{ liveStore.sessionData?.name }}
    q-btn.q-ml-md.bg-white(round flat icon="menu" size="16px")
      q-menu.bg-white(auto-close anchor="bottom start" v-if="liveStore.sessionId")
        q-list
          q-item.text-black(clickable v-close-popup @click="deleteSession()")
            q-item-section(avatar)
              q-icon(name="delete" color="warning")
            q-item-section
              q-item-label Delete Live Session
          q-item.text-black(clickable v-close-popup  @click="api.liveSession.downloadAudio(liveStore.sessionId)" :disable="liveStore.transcript.length === 0 ||liveStore.capturing")
            q-item-section(avatar)
              q-icon(name="download" color="black")
            q-item-section
              q-item-label Download Session Audio
          q-item.text-black(clickable v-close-popup  @click="downloadPrompts()" :disable="liveStore.prompts.length === 0")
            q-item-section(avatar)
              q-icon(name="download" color="black")
            q-item-section
              q-item-label Download Prompts
          q-item.text-black(clickable v-close-popup  @click="downloadTranscript()" :disable="liveStore.transcript.length === 0")
            q-item-section(avatar)
              q-icon(name="download" color="black")
            q-item-section
              q-item-label Download Transcript
          q-item.text-black(clickable v-close-popup @click="liveStore.triggerNewNameModal()")
            q-item-section(avatar)
              q-icon(name="edit" color="black")
            q-item-section
              q-item-label Update Session Name
          q-item.text-black(clickable v-close-popup @click="toggleDetails()")
            q-item-section(avatar)
              q-icon(name="toggle_on" color="black")
            q-item-section
              q-item-label Toggle Details
  .centered.full-width(v-if="nameLength >= 30")
    h5 {{ liveStore.sessionData?.name }}
  .centered.full-width(v-if="showDetails")
    .centered.q-gutter-md
      .col
        small Created: {{ new Date(sessionData.createdAt).toLocaleString() }}
      .col-auto
        small Updated: {{ new Date(sessionData.updatedAt).toLocaleString() }}
    //- h5 {{ liveStore.sessionData }}

//- q-card.q-pa-md.bg-white
//-   .centered.q-mt-md
//-     //- h4.q-pr-lg Conversation Recorder
//-   .centered
//-     q-btn(label="Start Conversation Capture" @click="startConversationCapture()" rounded outline icon="radio_button_checked" size="19px" ).bg-green-7.text-white
//-   .centered
//-     q-btn-dropdown( icon="settings_voice" rounded outline style="width:300px;").q-mt-sm
//-       template(v-slot:label)
//-         p.ellipsis.full-width.q-pl-sm {{ selectedMicName || "Select Mic" }}
//-       q-list
//-         q-item(v-for="device of convRecorder.micRecorder.devices" clickable v-close-popup @click="convRecorder.micRecorder.selectMic(device)")
//-           q-item-section(avatar)
//-             q-icon(name="mic" color="white" v-if="convRecorder.micRecorder.selectedMicData?.deviceId === device.deviceId")
//-           q-item-section
//-             q-item-label {{device.label}}
  //- .centered.q-gutter-md
    //- q-btn(label="Record" @click="convRecorder.startCapture()" rounded outline icon="radio_button_checked")
    //- q-btn(label="Stop Record" @click="convRecorder.stopCapture()" rounded outline icon="stop_circle")
    //- q-btn(label="Play Recording" @click="convRecorder.playRecording()" rounded outline icon="play_arrow")
    //- q-btn(label="Download" icon="download" @click="convRecorder.downloadRecording()" rounded outline)
</template>
<script lang="ts">
import { ConversationRecorder } from "lib/ConversationRecorder"
import { api } from "lib/api"
import { Dialog, Notify } from "quasar"
import { useLiveStore } from "src/stores/LiveStore"
import { PropType, defineComponent, reactive, shallowReactive } from "vue"
import AudioPlayer from "components/AudioPlayer.vue"
import { PromptsToMarkdown, downloadFile, formatTranscriptForDocs, promptsToDoc } from "lib/util"
export default defineComponent({
  components: { AudioPlayer },
  data() {
    return {
      liveStore: useLiveStore(),
      api,
      showDetails: false
    }
  },
  mounted() {
    setTimeout(() => {
      if (!this.liveStore.capturing && this.liveStore.transcript.length === 0) void this.liveStore.convRecorder.micRecorder.init()
    }, 1000)
  },
  beforeUnmount() {
    this.liveStore.transcribeS.end()
  },
  emits: ["liveSessionId"],
  computed: {
    sessionData() {
      if (!this.liveStore.sessionData) {
        return {
          createdAt: new Date(),
          updatedAt: new Date()
        } as any
      } else return this.liveStore.sessionData as any
    },
    nameLength() {
      const name = this.liveStore.sessionData?.name
      if (!name) return 0
      else return name.length
    },
    convRecorder() { return this.liveStore.convRecorder },
    selectedMicName() {
      const selectedMic = this.convRecorder.micRecorder.selectedMicData
      if (selectedMic) return selectedMic.label
      else return "Select Mic"
    }
  },
  methods: {
    async downloadTranscript() {
      await downloadFile(formatTranscriptForDocs(this.liveStore.transcript, this.liveStore.speakerNames), (this.liveStore.sessionData?.name || this.liveStore.sessionId) + "-transcript.txt")
    },
    async downloadPrompts() {
      await downloadFile(promptsToDoc(this.liveStore.prompts), (this.liveStore.sessionData?.name || this.liveStore.sessionId) + "-prompts.txt")
    },
    async deleteSession() {
      await this.liveStore.showDeleteSessionModal()
      await this.$router.push({ name: "live", params: { id: null } })
    },
    async toggleDetails() {
      this.showDetails = !this.showDetails
    },
    async seekTime(val:number) {
      const audioPlayer = this.$refs.audioPlayer as typeof AudioPlayer
      if (!audioPlayer) return
      console.log("seekTime", val)
      await audioPlayer.skipTo(val)
    },
    async startConversationCapture() {
      console.log("startConversationCapture")
      await this.liveStore.startTranscribe(this.liveStore.sessionId!)
      this.liveStore.capturing = true
    },
    async stopConversationCapture() {
      console.log("stopConversationCapture")
      await this.liveStore.stopTranscribe()
      this.liveStore.capturing = false
    }
  }
})
</script>
