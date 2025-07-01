<template lang="pug">
  div(style="max-width:95vw;")
    q-list(v-if="trainingSets.length" separator).full-width
      TrainingSetCard(selectable v-for="set in trainingSets" :key="set.id" :trainingSet="set" @updated="loadData" @setClicked="$emit('setClicked', $event)")
    div(v-else)
      .full-width(style="height:'100px'")
        .centered
          h6 No Training Sets Found
  </template>

<script lang="ts" setup>
import { ref, watch, onMounted, getCurrentInstance } from "vue"
import { type TrainingSet } from "lib/api"
import { trainingSetsGetUserSets } from "src/lib/orval"
import { catchErr } from "lib/util"
import TrainingSetCard from "./TrainingSetCard.vue"
import { useUserAuth } from "src/stores/userAuth"

const props = defineProps<{ readyOnly?: boolean }>()
const emit = defineEmits<{ (e: "setClicked", set: TrainingSet): void }>()

const trainingSets = ref<TrainingSet[]>([])
const userAuth = useUserAuth()

async function loadData() {
  try {
    if (!userAuth.loggedIn) {
      trainingSets.value = []
      return
    }
    const res = await trainingSetsGetUserSets({
      userId: userAuth.userId || "",
    })
    const models = res?.data || []
    trainingSets.value = props.readyOnly ? models.filter((m) => m.status === 1) : models
  } catch (e) {
    catchErr(e)
    trainingSets.value = []
  }
}

watch(
  () => userAuth.loggedIn,
  (val) => {
    if (val) void loadData()
    else trainingSets.value = []
  },
  { immediate: true },
)

onMounted(loadData)
</script>
