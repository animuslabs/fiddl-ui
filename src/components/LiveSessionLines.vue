<template lang="pug">
.centered
  .row.full-width.q-pr-lg.q-ml-md
    div.full-width
      div.q-ma-md(v-for="line,index in transcriptLines" :key="line.index" ).full-width
        .row.items-center(v-if="line.startTime>0")
          .col
            div(v-if="line.text.length>0").full-width
              q-chat-message(:text="[line.text]" :sent="line.speaker[0] == '1'? false:true" :bg-color="index%2==0?'grey-4':'grey-3'")
                template(v-slot:name)
                  p.text-weight-bold {{ getSpeakerName(line.speaker) }}
                template(v-slot:stamp)
                  //- div {{ new Date() line.startTime.toFixed(2).replace(".",":") }}
                  //-   div.text-white.q-mr-sm {{ printTimestamp(line.startTime) }}
                template(v-slot:default)
                  .q-ma-sm
                    p.text-black {{line.text}} #[q-spinner-dots.q-ml-md(v-if="line.index==transcriptLines.length-1")]
            .row.justify-end.q-mb-sm.q-ml-xs(v-if="index%2==0")
              q-btn(rounded size="md" flat color="accent" :label="printTimestamp(line.startTime)" @click="seekTime(line.startTime -1)")
            .row.q-mb-sm.q-ml-xs(v-else)
              q-btn(rounded size="md" flat color="accent" :label="printTimestamp(line.startTime)" @click="seekTime(line.startTime -1)")
          //- .col-auto
          //-   q-btn(icon="play_arrow" round size="sm" outline color="positive")
            //- h4 hi

          //- div idx: {{  line.index }}
          //- div speaker: {{  line.speaker }}
          //- p {{ line.text }}
  div(style="height:200px;").full-width
</template>

<script lang="ts">
import { TranscriptLine } from "lib/types"
import { getSpeakerName } from "lib/util"
import { useUserAuth } from "src/stores/userAuth"
import { PropType, defineComponent } from "vue"
export default defineComponent({
  data: () => ({
    userAuth: useUserAuth()
  }),
  emits: ["seekTime"],
  props: {
    speakerNames: {
      type: {} as PropType<Record<string, string>> | undefined,
      required: false,
      default: undefined
    },
    sessionLines: {
      type: Array as PropType<TranscriptLine[]>,
      required: true
    }
  },
  computed: {
    transcriptLines():TranscriptLine[] {
      return this.sessionLines
    }
  },
  methods: {
    seekTime(val:number) {
      this.$emit("seekTime", val)
    },
    getSpeakerName(speaker:string):string {
      if (!this.speakerNames) return speaker
      return getSpeakerName(speaker, this.speakerNames, this.userAuth.userData?.name || "caller")
    },
    printTimestamp(seconds:number):string {
      const date = new Date()
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const sec = Math.floor(seconds % 60)
      return `${hours}:${minutes}:${sec}`
    }
  },
  watch: {

  }
})
</script>
