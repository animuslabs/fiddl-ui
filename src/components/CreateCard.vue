<template lang="pug">
  div
    q-card(class="create-card" style="overflow: hidden;")
      div
        q-tabs(v-model="store.activeTab" class="text-primary" align="center" inline-label)
          q-tab(name="image" label="Image" icon="image")
          q-tab(name="video" label="Video" icon="movie")
        q-separator
        q-tab-panels.bg-transparent(
          v-model="store.activeTab"
          swipeable
          animated
          :style="quasar.screen.lt.md ? 'height:calc(95vh - env(safe-area-inset-bottom)); height:calc(95dvh - env(safe-area-inset-bottom));' : 'flex:1 1 auto; min-height:0; overflow:hidden;'"
        )
          q-tab-panel(name="image" style="display:flex; flex-direction:column; height:100%; padding:16px 16px 0 16px;")
            ImageForm(:showBackBtn="showBackBtn" @back="$emit('back')"  @created="emit('created')")
          q-tab-panel(name="video" style="display:flex; flex-direction:column; height:100%; padding:16px 16px 0 16px;")
            VideoForm(@back="$emit('back')" @created="emit('created')" )

</template>

<script lang="ts" setup>
import { ref, watch, onMounted } from "vue"
import { LocalStorage, useQuasar } from "quasar"
import { useRouter, useRoute } from "vue-router"
import { useCreateImageStore } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import type { CustomModel } from "lib/api"
import ImageForm from "components/ImageForm.vue"
import VideoForm from "components/VideoForm.vue"
import CustomModelsList from "./CustomModelsList.vue"
import type { MediaType } from "lib/types"
import { createCardStore } from "src/stores/createCardStore"
import { useUserAuth } from "src/stores/userAuth"
const props = defineProps<{ showBackBtn?: boolean; customModel?: CustomModel | null }>()
const emit = defineEmits(["created", "back", "activeTab"])

const router = useRouter()
const route = useRoute()
const store = createCardStore
const createStore = useCreateImageStore()
const creationsStore = useImageCreations()
const quasar = useQuasar()

const showModelPicker = ref(false)

watch(
  () => store.activeTab,
  (val) => {
    LocalStorage.set("createMode", val)
    void router.replace({ params: { activeTab: val } })
    emit("activeTab", store.activeTab)
  },
  { immediate: true },
)

onMounted(() => {
  // const savedReq = LocalStorage.getItem("req")
  // if (savedReq) createStore.setReq(savedReq as any)
  if (!route.params?.activeTab) {
    const savedMode = LocalStorage.getItem("createMode")
    if (savedMode) store.activeTab = savedMode as MediaType
  } else store.activeTab = route.params?.activeTab as MediaType
  if (!store.activeTab) store.activeTab = "image"
})

watch(
  () => props.customModel,
  (newModel) => {
    if (!newModel) {
      createStore.state.req.customModelId = undefined
      createStore.state.req.customModelName = undefined
      createStore.state.customModel = null
    } else {
      createStore.state.req.customModelId = newModel.id
      createStore.state.req.model = "custom"
    }
  },
  { immediate: false },
)

async function setCustomModel(model: CustomModel) {
  showModelPicker.value = false
  createStore.state.req.customModelId = model.id
  createStore.state.req.customModelName = model.name
  // Ensure the filter reflects the custom model BEFORE loading so the query includes it
  creationsStore.dynamicModel = true
  creationsStore.filter.model = "custom"
  creationsStore.filter.customModelId = model.id
  await creationsStore.setCustomModelId(model.id, useUserAuth().userId || undefined)
  // LocalStorage.set("req", createStore.state.req)
}

watch(
  () => createStore.state.req.model,
  (val) => {
    if (val === "custom" && !createStore.state.req.customModelId && !createStore.state.customModel) {
      showModelPicker.value = true
    }
    if (val !== "custom") {
      createStore.state.req.customModelId = undefined
      createStore.state.req.customModelName = undefined
      createStore.state.customModel = null
    }
  },
)
</script>

<style scoped>
textarea::-webkit-resizer {
  display: none;
}

.create-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.create-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}

.form-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  height: 700px;
}

@media (max-width: 600px) {
  .form-scroll {
    height: calc(100vh - 125px);
    height: calc(100dvh - 125px);
  }
}
</style>
