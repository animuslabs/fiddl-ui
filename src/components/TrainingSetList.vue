<template lang="pug">
  div(style="max-width:95vw;")
    q-list(v-if="trainingSets.length" separator ).full-width
      TrainingSetCard.q-mb-md(selectable v-for="set in trainingSets" :key="set.id" :trainingSet="set" @updated="loadData" @setClicked="$emit('setClicked', $event)")
    div(v-else)
      .full-width(style="height:'100px'")
        .centered
          h6 No Training Sets Found
  </template>

<script lang="ts" setup>
import { watch, onMounted, computed } from "vue"
import { type TrainingSet } from "lib/api"
import { catchErr } from "lib/util"
import TrainingSetCard from "./TrainingSetCard.vue"
import { useUserAuth } from "src/stores/userAuth"
import { useForgeStore } from "src/stores/forgeStore"

const props = defineProps<{ readyOnly?: boolean }>()
const emit = defineEmits<{ (e: "setClicked", set: TrainingSet): void }>()

const forgeStore = useForgeStore()
const userAuth = useUserAuth()

const trainingSets = computed<TrainingSet[]>(() => {
  if (!userAuth.loggedIn) return []
  const base = forgeStore.state.userTrainingSets || []
  return props.readyOnly ? base.filter((m) => m.status === 1) : base
})

async function loadData() {
  try {
    if (!userAuth.loggedIn) return
    await forgeStore.loadUserTrainingSets(true)
  } catch (e) {
    catchErr(e)
  }
}

watch(
  () => userAuth.loggedIn,
  (val) => {
    if (val) void loadData()
  },
  { immediate: true },
)

onMounted(() => {
  void loadData()
})
</script>
