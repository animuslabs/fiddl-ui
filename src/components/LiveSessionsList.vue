<template lang="pug">
q-card.q-pa-md
  .centered.q-mb-md
    h5 Previous Live Sessions #[small.text-grey-6 ({{ liveSessions.length }})]
  q-scroll-area(style="width:800px; height:90vh;")
    q-list(style="width:800px; max-width:90vw;" v-if="!loading || liveSessions.length >0").bg-white
      div(v-for="session in liveSessions" :key="session.id" v-if="liveSessions.length > 0").text-black.cursor-pointer
        q-separator
        .row.items-center
          .col-auto
            .row(style="width:30px;")
              q-btn(icon="sym_o_edit" size="sm" flat round color="grey" @click="editName(session.id)")
              //- q-btn(icon="delete" size="sm" flat round color="grey" @click="deleteSession(session.id)")
          .col
            q-item(v-if="liveSessions.length > 0" clickable @click="$router.push({ name: 'live', params: { id:session.id },force:true })").text-black.cursor-pointer.full-width
              .row.q-gutter-md.full-width
                .col(style="text-overflow:ellipsis; white-space:nowrap;")
                  p {{ session.name || session.id }}
                .col-grow
                .col-auto
                  div(style="width:200px;")
                    small Speakers
                    .text-grey-7(v-for="speaker of printSpeakerNames(session)")
                      | {{ speaker }}
                .col-auto
                  div(style="width:200px;")
                    small Recorded
                    .text-grey-7 {{ new Date(session.createdAt).toLocaleString() }}
                  div(style="width:200px;")
                    small Edited
                    .text-grey-7 {{ new Date(session.updatedAt).toLocaleString() }}
                //- .col-grow
                //- .col-auto
                //-   q-btn(icon="delete" flat @click="deleteRecording(recording.id)")
    div(v-else).q-ma-sm.q-pa-sm
      .centered.text-grey-7 No live sessions yet
  div(style="height:100px; width:800px; max-width:90vw;" v-if="loading && liveSessions.length ===0").relative-position
      q-inner-loading(:showing="loading")
        q-spinner(size="50px")

</template>

<script lang="ts">
import { PropType, defineComponent } from "vue"
import { UserFile } from "lib/types"
import { api } from "lib/api"
import { LiveSession } from "lib/prisma"
import { useLiveStore } from "src/stores/LiveStore"
import { Loading } from "quasar"

export default defineComponent({
  data: () => ({
    liveStore: useLiveStore()
  }),
  // props: {
  //   // liveSessions: {
  //   //   type: Array as PropType<LiveSession[]>,
  //   //   required: true
  //   // }
  // },
  emits: {
    refresh: null
  },
  computed: {
    liveSessions():LiveSession[] {
      return this.liveStore.liveSessions
    },
    loading():boolean {
      // return true
      return this.liveStore.loading
    }
  },
  methods: {
    printSpeakerNames(session:LiveSession) {
      if (!session.speakerNames) return []
      // return Object.values(JSON.parse(session.speakerNames.toString() as any) as any)
      const speakers = session.speakerNames as any
      return Object.values(speakers)
    },
    async editName(id:string) {
      await this.liveStore.triggerNewNameModal(id)
      Loading.show()
      await this.liveStore.loadUserLiveSessions().catch(console.error)
      Loading.hide()
      // this.$emit("refresh")
    },
    async deleteSession(id:string) {
      await api.liveSession.delete(id)
      Loading.show()
      await this.liveStore.loadUserLiveSessions().catch(console.error)
      Loading.hide()
    }
  }
})
</script>
