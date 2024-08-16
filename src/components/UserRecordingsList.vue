<template lang="pug">
q-card.q-pa-md
  .centered
    h5 Saved Recordings
  q-list(style="width:600px; max-width:90vw;").bg-white
    q-item(v-for="recording in recordings" :key="recording.id" v-if="recordings.length > 0" clickable @click="$router.push({ name: 'prompt', params: { id:recording.id } })").text-black.cursor-pointer
      .row.q-gutter-md.items-center.full-width
        .col-auto
          .text-h6 {{ recording.name }}
        .col-grow
        .col-auto
          small Uploaded
          .text-grey-7 {{ recording.createdAt.toLocaleString() }}
        //- .col-grow
        //- .col-auto
        //-   q-btn(icon="delete" flat @click="deleteRecording(recording.id)")
    div(v-else).q-ma-sm.q-pa-sm
      .centered.text-grey-7 No recordings yet
  q-btn.full-width.q-mt-sm(label="upload recording" icon="upload" flat @click="$router.push({name:'upload'})")

</template>

<script lang="ts">
import { PropType, defineComponent } from "vue"
import { UserFile } from "lib/types"
import { api } from "lib/api"
export default defineComponent({
  props: {
    recordings: {
      type: Array as PropType<UserFile[]>,
      required: true
    }
  },
  emits: {
    refresh: null
  },
  methods: {
    async deleteRecording(id:string) {
      await api.file.delete(id)
      this.$emit("refresh")
    }
  }
})
</script>
