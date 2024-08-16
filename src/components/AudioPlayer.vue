<template lang="pug">
audio(:src="src" controls ref="audioPlayer" v-if="authToken")
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue"
import { api, apiUrl, authToken } from "lib/api"

export default defineComponent({
  name: "AudioStreamer",
  data() {
    return {
      apiUrl,
      authToken
    }
  },
  props: {
    sessionId: {
      type: String,
      required: true
    }
  },
  mounted() {
    // this.player.volume = 1
  },
  methods: {
    skipTo(num:number) {
      console.log("skipTo", num)
      this.player.currentTime = num
      void this.player.play()
    }
  },
  computed: {
    player() {
      return this.$refs.audioPlayer as HTMLAudioElement
    },
    src() {
      const val = `${apiUrl}/liveSession/streamAudio/${this.sessionId}?token=${this.authTokenUri}`
      console.log(val)
      return val
    },
    authTokenUri() {
      if (authToken.value) return encodeURIComponent(authToken.value)
      else return ""
    }
  }
})
</script>

<style scoped>
/* Add your styles here */
</style>
