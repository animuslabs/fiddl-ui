<template lang="pug">
q-card.training-card.relative-position.overflow-hidden(style="width:550px; max-width:95vw;")
  .absolute.thumb-bg(style="z-index:0;")
    .row.no-wrap
      div(v-for="id in trimmedThumbnails" :key="id" style="width:80px;")
        .thumb-wrap
          img.thumb-img(:src="s3Img(thumbnailKey(trainingSet.id,id))")
  .row.info-row.q-gutter-xs.items-center.q-pa-sm.relative-position(style="z-index:1;")
    .row.full-width.q-gutter-xs.items-center.q-pa-md(style="z-index:1;")
      .col-auto(v-if="!hideButtons")
        .row
          q-btn(icon="delete" flat color="accent" @click.stop="deleteSet" round)
            q-tooltip
              p Delete Set
        .row
          q-btn(icon="edit_note" flat color="white" @click.stop="editSet" round)
            q-tooltip
              p Edit Set Details
        .row
          q-btn(icon="model_training" flat color="white" @click.stop="router.push({name:'forge',params:{mode:'createModel'},query:{trainingSetId:trainingSet.id}})" round)
            q-tooltip
              p Train Model
      .col-auto(v-else)
        .row
          q-btn(icon="visibility" flat color="white" @click.stop="router.push({name:'trainingSet',params:{trainingSetId:trainingSet.id}})" round)
            q-tooltip
              p View Set
      q-separator(vertical)
      .col.full-width(@click.native="handleSetClicked" :style="selectable ? 'cursor:pointer' : ''")
        .q-ml-md.q-mb-sm(style="text-transform: capitalize;")
          h3 {{ trainingSet.name }}
          p.ellipsis-3-lines {{ trainingSet.description}}
        q-separator(spaced style="background-color:rgba(255, 255, 255, 0.28)")
        .row.stats-row.q-gutter-md.full-width.no-wrap
          .col-auto
            p Created
            h5 {{ timeSince(new Date(trainingSet.createdAt)) }}
          .col-auto
            p Images
            h5 {{ trainingSet.numImages }}

  q-dialog(v-model="showEditNameDialog")
    q-card(style="width:600px; max-width:100vw")
      .q-pa-md
        h5.q-mb-sm Edit Training Set
        q-input.q-mb-lg(v-model="newSetName" label="Name" type="text" :rules="[val => !!val || 'Name is required']")
        q-input.q-mb-lg(v-model="newSetDescription" label="Description" type="textarea" :rows="4" autogrow :rules="[val => !!val || 'Description is required']" clearable)
        .row.q-gutter-md
          q-btn(label="Cancel" @click="showEditNameDialog=false" color="accent" flat)
          .col-grow
          q-btn(label="Update" @click="changeSetName" color="primary" flat)
  </template>

<script lang="ts" setup>
import { ref, computed } from "vue"
import { Notify, Dialog, useQuasar } from "quasar"
import { type TrainingSet } from "lib/api"
import { catchErr, timeSince } from "lib/util"
import { s3Img } from "lib/netlifyImg"
import { trainingSetsDeleteSet, trainingSetsEditSet } from "src/lib/orval"
import { useRouter } from "vue-router"
const router = useRouter()
const props = defineProps({
  trainingSet: { type: Object as () => TrainingSet, required: true },
  hideButtons: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (e: "updated"): void
  (e: "setClicked", set: TrainingSet): void
}>()

const newSetName = ref("")
const newSetDescription = ref("")
const showEditNameDialog = ref(false)

const trimmedThumbnails = computed(() => {
  const ids = props.trainingSet.thumbnailIds || []
  return ids.length > 4 ? ids.slice(0, 7) : ids
})

const statusText = computed(() => {
  const s = props.trainingSet.status
  return s === 0 ? "Awaiting Upload" : s === 1 ? "Ready" : "Error"
})

function thumbnailKey(setId: string, thumbId: string) {
  return `trainingSets/${setId}/thumbnails/${thumbId}.webp`
}

function handleSetClicked() {
  emit("setClicked", props.trainingSet)
}

async function deleteSet() {
  Dialog.create({
    title: "Delete Set: " + props.trainingSet.name,
    message: "Are you sure you want to delete this model?",
    ok: { label: "Yes", color: "negative" },
    cancel: { label: "No", color: "primary" },
  }).onOk(async () => {
    try {
      await trainingSetsDeleteSet({ trainingSetId: props.trainingSet.id })
      Notify.create(`${props.trainingSet.name} deleted`)
      emit("updated")
    } catch (e) {
      catchErr(e)
    }
  })
}

function editSet() {
  newSetName.value = props.trainingSet.name || ""
  newSetDescription.value = props.trainingSet.description || ""
  showEditNameDialog.value = true
}

async function changeSetName() {
  try {
    await trainingSetsEditSet({ trainingSetId: props.trainingSet.id, newName: String(newSetName.value), newDescription: String(newSetDescription.value) })
    Notify.create("Name updated")
    showEditNameDialog.value = false
    emit("updated")
  } catch (e) {
    catchErr(e)
  }
}
</script>

<style scoped>
@media (min-width: 601px) {
  .stats-row > .col-auto {
    flex: 1 1 0;
    min-width: 120px;
  }

  .stats-row {
    gap: 32px;
  }
}

.thumb-wrap {
  height: 300px;
  overflow: hidden;
}
@media (max-width: 600px) {
  .training-card {
    min-height: 140px;
  }

  .thumb-wrap {
    height: 120px;
  }
  .thumb-bg {
    height: 120px;
  }

  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .info-row h3 {
    font-size: 1.2rem;
  }
  .info-row h5,
  .info-row p {
    font-size: 0.8rem;
  }
}

.thumb-bg {
  filter: blur(14px);
  opacity: 0.8;
  pointer-events: none;
  /* left: -80px; */
  flex-wrap: nowrap;
}

.thumb-wrap {
  position: relative;
  /* width: 60px; your thumb size */
  height: 300px;
  overflow: hidden; /* clips overflow */
}

.thumb-img {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%; /* a bit larger than the box so no gaps appear */
  height: 120%;
  object-fit: cover; /* fills the box */
  transform: translate(-50%, -50%); /* centre the crop */
}
</style>
