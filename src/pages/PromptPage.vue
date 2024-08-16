<template lang="pug">
q-page.full-height
  div(v-if="!targetRecordingId")
    .centered.q-mt-md
      UserRecordings(:recordings="userFiles" @refresh="loadUserFiles")


  div(v-else-if="loading").q-pt-xl
    .centered.relative-position
      q-spinner(size="100px")
      .absolute-center
        h4 {{ progress }}%
    .full-width(v-if="processing")
      .centered.q-pt-lg
        h3 processing...
      q-linear-progress(:value="progress/100 +.1" color="primary")
      //- p {{ processing }}
      //- p {{ progress }}
  div(v-else)
    q-tabs(v-model="currentTab" align="justify" class="q-mb-md")
      q-tab(v-for="tab in tabs" :key="tab.name" :label="tab.label" :name="tab.name")
    .centered(style="width:800px; max-width:90vw;")
      div(v-if="currentTab == 'transcription'")
        .centered(v-if="fileData")
          TranscriptionViewer(:transcriptionChunks="transcriptionChunks" style=" max-width:800px; height:70vh; overflow:scroll;").q-ma-md
      div(v-if="currentTab == 'meta'")
        MetaCards(:fileData="fileData").q-ma-md
      div(v-if="currentTab == 'prompt'")
        PromptCard(:id="fileData.id || '' ").q-ma-md



</template>

<script lang="ts">
import { defineComponent } from "vue"
import { Todo, Meta } from "components/models"
import DropBox from "components/DropBox.vue"
import { api } from "src/lib/api"
import { makeTranscriptionChunks } from "src/lib/transcriptionUtil"
import TranscriptionViewer from "components/TranscriptionViewer.vue"
import MetaCards from "src/components/MetaCards.vue"
import PromptCard from "src/components/PromptCard.vue"
import { UserFile } from "lib/types"
import { useUserAuth } from "src/stores/userAuth"
import UserRecordings from "src/components/UserRecordingsList.vue"

const tabs = [
  { name: "transcription", label: "Transcript" },
  { name: "meta", label: "Intel" },
  { name: "prompt", label: "Question" }
]
let interval:NodeJS.Timeout | null = null
export default defineComponent({
  components: {
    TranscriptionViewer,
    MetaCards,
    PromptCard,
    UserRecordings
  },
  data() {
    return {
      currentTab: "transcription",
      fileData: null as any,
      tabs,
      loading: true,
      processing: false,
      progress: 0,
      userFiles: [] as UserFile[],
      userAuth: useUserAuth()

    }
  },
  mounted() {
    void this.loadData()
    // this.startProcessing()
  },
  methods: {
    async loadUserFiles() {
      this.userFiles = await api.files.getUserFiles()
    },
    startProcessing() {
      if (this.processing) return
      this.processing = true
      interval = setInterval(() => {
        this.progress += 1
        if (this.progress >= 100) {
          if (interval) clearInterval(interval)
        }
      }, 300)
    },
    async loadData() {
      if (!this.targetRecordingId) return
      this.loading = true
      const id = this.$route.params.id
      if (!id || typeof id != "string") return
      const result = await api.getFileData(id).catch(console.error)
      if (!result) return
      if (result.processing) this.startProcessing()
      if (result && !result.processing) {
        this.fileData = result
        this.loading = false
        if (interval) clearInterval(interval)
      } else setTimeout(() => this.loadData(), 3000)
    }
  },
  computed: {
    targetRecordingId():string|undefined {
      const data = this.$route.params.id
      if (typeof data == "string") return data
      else return undefined
    },
    transcriptionChunks() {
      const data = this.fileData
      if (!data || data.processing || !data.transcription) return []
      return makeTranscriptionChunks(this.fileData.transcription)
    }
  },
  watch: {
    $route() {
      void this.loadData()
    },
    "userAuth.loggedIn": {
      immediate: true,
      handler() {
        if (this.userAuth.loggedIn) {
          void this.loadUserFiles()
        }
      }
    }
  }
})


</script>
