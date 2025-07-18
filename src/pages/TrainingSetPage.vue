<template lang="pug">
  q-page.flex.column.full-width
    .centered.q-mt-lg
      h2(v-if="!state.selectedSet") Training Sets
      h2(v-else) Training Set
    template(v-if="state.selectedSet")
      .centered.q-mt-md
        TrainingSetCard(:trainingSet="state.selectedSet" @updated="selectedSet.refetch()" )
      .centered.q-gutter-md.q-mt-sm
        q-btn.q-mt-md.q-mb-md(size="md" flat label="All Sets" icon="arrow_back" color="grey" @click="$router.push({ name:'trainingSet' })")
        q-btn.q-mt-md.q-mb-md(v-if="state.showSetModels == false" @click="state.showSetModels = !state.showSetModels" size="md" outline label="View Models" icon="lightbulb" color="primary" )
        q-btn.q-mt-md.q-mb-md(v-else size="md" @click="state.showSetModels = !state.showSetModels" outline label="View Set" icon="burst_mode" color="primary")
        q-btn.q-mt-md.q-mb-md( size="md" outline label="Train Model" icon="model_training" color="primary" @click="router.push({name:'forge',params:{mode:'createModel'},query:{trainingSetId:state.selectedSet.id}})")
      q-separator(color="grey-8" )
      q-scroll-area.q-pa-md(style="height:calc(100vh - 240px);" v-if="!state.showSetModels")
        .centered.q-col-gutter-md.flex-wrap
          MediaGallery(:mediaObjects="thumbnailObjects" layout="mosaic" :cols-desktop="6" style="max-width:1000px;" :rowHeightRatio="0.8")
      q-scroll-area.q-pa-md(style="height:calc(100vh - 240px);" v-else)
        .centered
          h4.text-capitalize Models Trained using this set
        q-separator
        .centered
          CustomModelsList(style="max-width:10px;" :trainingSetId="state.selectedSet.id")
    template(v-else)
      q-scroll-area.full-width.q-pa-md(style="height:calc(100vh - 240px);")
        .centered.q-gutter-lg.flex-wrap
          TrainingSetCard.cursor-pointer(
            v-for="set in state.userSets"
            :key="set.id"
            :trainingSet="set"
            @click="$router.push({ name:'trainingSet', params:{ trainingSetId:set.id } })"
            @updated="trainingSets.refetch"
          )
  </template>

<script lang="ts" setup>
import { ref, watchEffect, onMounted, reactive, computed, toRef, toValue, unref } from "vue"
import { useRoute, useRouter } from "vue-router"
import TrainingSetCard from "components/TrainingSetCard.vue"
import { s3Img, trainingSetThumbnailKey } from "lib/netlifyImg"
import { type TrainingSet } from "lib/api"
import { trainingSetsGetUserSets, useTrainingSetsGetSet, useTrainingSetsGetUserSets } from "lib/orval"
import { useUserAuth } from "src/stores/userAuth"
import MediaGallery, { type MediaGalleryMeta } from "src/components/MediaGallery.vue"
import CustomModelsList from "src/components/CustomModelsList.vue"
const route = useRoute()
const router = useRouter()
const userAuth = useUserAuth()

const trainingSets = useTrainingSetsGetUserSets(
  computed(() => ({ userId: userAuth.userId ?? "" })),
  { query: { enabled: computed(() => !!userAuth.loggedIn && !!userAuth.userId) } },
)

const targetTrainingSetId = computed(() => route.params.trainingSetId as string | undefined)
const selectedSet = useTrainingSetsGetSet(
  computed(() => ({ trainingSetId: targetTrainingSetId.value ?? "" })),
  { query: { enabled: computed(() => !!targetTrainingSetId.value) } },
)

const state = reactive({
  selectedSet: computed(() => selectedSet.data.value?.data),
  userSets: computed(() => trainingSets.data.value?.data),
  showSetModels: false as boolean,
})

const thumbnailObjects = computed<MediaGalleryMeta[]>(() => {
  const set = state.selectedSet
  console.log(set)
  if (!set) return []
  else return set.thumbnailIds.map((el) => ({ type: "image", id: el, url: s3Img(trainingSetThumbnailKey(set.id, el)) }))
})

console.log(toValue(thumbnailObjects))
</script>
