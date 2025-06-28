<template lang="pug">
  q-list(v-if="trainingSets?.length").full-width
    q-item(v-for="trainingSet in trainingSets" :key="trainingSet.id")
      .row.q-gutter-xs.items-center
        .col-auto
          .row
            q-btn(icon="delete" flat color="accent" @click="deleteSet(trainingSet)" round)
          .row
            q-btn(icon="edit" flat color="white" @click="editSetName(trainingSet)" round)
          //- .row
          //-   q-btn(icon="edit" flat color="white" @click="finalize(trainingSet)" round)
        .col.cursor-pointer(@click.native="handleSetClicked(trainingSet)" v-if="$q.screen.width > 500")
          .q-ml-md(style="text-transform: capitalize;")
            h3 {{ trainingSet.name }}
          .row.q-gutter-md.full-width
            .col-auto(style="width:100px;")
              p Status
              h4 {{ trainingSet.status }}
            .col-auto(style="width:200px;")
              p Created
              h5 {{ timeSince(new Date(trainingSet.createdAt)) }}
            .col-auto(style="width:120px;")
              small Number of Images
              h6 {{ trainingSet.numImages }}
          .row.q-ml-md
            .col-auto(v-if="trainingSet.thumbnailIds?.length")
              .full-width.q-mt-md
              .row
                div
                div(v-for="thumbnailId in trimThumbnails(trainingSet)" :key="thumbnailId")
                  .relative-position(style="width:60px; height:90px;")
                    img(:src="s3Img(thumbnailKey(trainingSet.id,thumbnailId))" :style="lgImgStyle")
              .lt-md.full-width.q-mt-md
        .col.cursor-pointer(@click.native="handleSetClicked(trainingSet)" v-else)
          .row.q-ml-sm
            .col-auto
              h4(style="width:250px; overflow:hidden").ellipsis {{ trainingSet.name }}
            .col-auto.q-mr-md
                small Status
                p(style="text-transform:capitalize") {{ trainingSet.status == 0 ? "Awaiting Upload" : trainingSet.status == 1 ? "Ready" : "Error" }}
            .col-auto.q-mr-md
              small Created
              p {{ timeSince(new Date(trainingSet.createdAt)) }}
            .col-auto
              small Number of Images
              h6 {{ trainingSet.numImages }}
          .row
            .col-auto(v-if="trainingSet.numImages").q-mt-sm
              .lt-md.full-width
              .row
                .q-ml-sm
                div(v-for="thumbnailId in trainingSet.thumbnailIds || []" :key="thumbnailId")
                  .relative-position(style="width:30px; height:20px;")
                    img(:src="s3Img(thumbnailKey(trainingSet.id,thumbnailId))" :style="smImgStyle")
              .lt-md.full-width.q-mt-md
        .full-width
          q-separator(color="grey-9" spaced="20px")

  div(v-else)
    .full-width(style="height: '100px'")
      .centered
        h6 No Training Sets Found
  q-dialog(ref="editModelDialog" v-model="showEditNameDialog")
    q-card
      .q-ma-md
        h5.q-mb-sm Edit Model Name
        q-input.q-mb-lg(v-model="newSetName" )
        .row.q-gutter-md
          q-btn(label="Cancel" @click="showEditNameDialog=false" color="accent" flat)
          .col-grow
          q-btn(label="Update" @click="changeSetName()" color="primary" flat)
</template>
<script lang="ts">
import { CustomModel, CustomModelWithRequests, TrainingSet } from "lib/api"
import { catchErr } from "lib/util"
import { Dialog, Notify, useQuasar } from "quasar"
import { defineComponent } from "vue"
import { modelsSetModelPrivacy, modelsSetModelName, modelsGetUserModels, modelsDeleteModel, trainingSetsRenameSet, trainingSetsGetUserSets, trainingSetsFinalizeSet, trainingSetsDeleteSet } from "src/lib/orval"
import { timeSince } from "lib/util"
import { img, s3Img } from "lib/netlifyImg"
const thumbnailKey = (trainingSetId: string, thumbnailId: string) => `trainingSets/${trainingSetId}/thumbnails/${thumbnailId}.webp`

export default defineComponent({
  components: {},
  props: {
    readyOnly: {
      type: Boolean,
      default: false,
      required: false,
    },
  },
  emits: {
    setClicked: (set: TrainingSet) => true,
  },
  data: function () {
    return {
      smImgStyle: "width:50px; height:50px; object-fit:cover; border-radius:5px; position:absolute; bottom:-25px; box-shadow: 0px 1px 15px rgba(0,0,0,.5) !important",
      lgImgStyle: "width:100px; height:100px; object-fit:cover; border-radius:25px; position:absolute; bottom:-5px; box-shadow: 0px 1px 15px rgba(0,0,0,.5) !important",
      $q: useQuasar(),
      trainingSets: [] as TrainingSet[] | null,
      timeSince,
      img,
      s3Img,
      thumbnailKey,
      newSetName: "" as string | number | null,
      showEditNameDialog: false,
      editingSetNameId: null as string | null,
    }
  },
  computed: {},
  watch: {
    "$userAuth.loggedIn": {
      async handler(val) {
        if (!val) return (this.trainingSets = [])
        await this.loadData()
      },
      immediate: true,
    },
  },
  mounted() {},
  methods: {
    trimThumbnails(trainingSet: TrainingSet) {
      if (!trainingSet.thumbnailIds || trainingSet.thumbnailIds.length <= 4) return trainingSet.thumbnailIds
      return trainingSet.thumbnailIds.slice(0, 4)
    },
    async finalize(trainingSet: TrainingSet) {
      if (!trainingSet.id) return
      try {
        await trainingSetsFinalizeSet({ trainingSetId: trainingSet.id })
        Notify.create("Training Set finalized successfully")
        await this.loadData()
      } catch (error) {
        catchErr(error)
      }
    },
    async changeSetName() {
      if (!this.editingSetNameId) return
      try {
        await trainingSetsRenameSet({ trainingSetId: this.editingSetNameId, newName: String(this.newSetName) })
        this.showEditNameDialog = false
        Notify.create("Training Set name updated to: " + this.newSetName)
        await this.loadData()
      } catch (error) {
        catchErr(error)
      }
    },
    editSetName(trainingSet: TrainingSet) {
      this.editingSetNameId = trainingSet.id
      this.newSetName = trainingSet.name || ""
      this.showEditNameDialog = true
    },
    async loadData() {
      try {
        if (!this.$userAuth.loggedIn) {
          this.trainingSets = []
          return
        }
        const response = await trainingSetsGetUserSets({ userId: this.$userAuth.userId || "" })
        const models = response?.data || []

        if (!this.readyOnly) {
          this.trainingSets = models
        } else {
          this.trainingSets = models?.filter((m) => m.status === 1)
        }
      } catch (error) {
        catchErr(error)
        this.trainingSets = []
      }
    },
    handleSetClicked(trainingSet: TrainingSet) {
      this.$emit("setClicked", trainingSet)
    },
    async deleteSet(trainingSet: TrainingSet) {
      console.log(trainingSet)
      Dialog.create({
        title: "Delete Set: " + trainingSet.name,
        message: "Are you sure you want to delete this model?",
        ok: {
          label: "Yes",
          color: "negative",
        },
        cancel: {
          label: "No",
          color: "primary",
        },
      }).onOk(async () => {
        try {
          await trainingSetsDeleteSet({ trainingSetId: trainingSet.id })
          Notify.create(`${trainingSet.name} deleted`)
          await this.loadData()
        } catch (error) {
          catchErr(error)
        }
      })
    },
  },
})
</script>
