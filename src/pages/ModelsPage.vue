<template lang="pug">
q-page.absolute-position
  div.bg-grey-10.z-top(style="position:sticky; top:50px;")
    .centered
      h2 Models
    //- q-separator(color="grey-8" spaced)
    div.q-mb-md.q-pt-sm.q-pb-xs.bg-grey-9( style="overflow-y: hidden; scrollbar-width: none;")
      .row.no-wrap.items-center.q-gutter-md
        q-chip.cursor-pointer(
          v-for="tag in modelTags"
          :key="tag"
          clickable
          :color="filter.tag === tag ? 'accent' : 'grey-10'"
          :text-color="filter.tag === tag ? 'black' : 'white'"
          @click="selectTag(tag)"
          style="height:35opx;"
        )
          h4 {{ tag }}
  .centered(v-if="filter.tag")
    q-btn(label="View All" size="sm" color="secondary" flat @click="filter.tag = null")
    h2 {{ filter.tag }} Models
  .row.q-ma-md
    .col-12.col-sm-6.col-md-4.col-lg-3(v-for="model in modelsStore.allModels.value" :key="model.slug")
      ModelCard.q-ma-sm( selectable :model="model" :key="model.slug" @chipClick="selectTag" @click="toModelPage(model)")
  //- .centered
    q-btn(label="reload" @click="modelsStore.loadAllModels()")
  //- pre {{ modelsStore.loading }}
  //- pre {{ modelsStore.filteredBaseModels }}
  //- q-separator(color="grey-8")



</template>
<style scoped>
.q-chip {
}
</style>

<script setup lang="ts">
import { modelTags, type ModelTags } from "lib/imageModels"
import type { MediaType } from "lib/types"
import { reactive, watch } from "vue"
import ModelCard from "components/ModelCard.vue"
import * as modelsStore from "stores/modelsStore"
import { match } from "ts-pattern"
import { useRouter } from "vue-router"
import { type ModelsGetPublicModels200Item } from "lib/orval"
const router = useRouter()
const filter = reactive({
  type: "all" as MediaType | "all",
  tag: null as ModelTags | null,
})

const toModelPage = (model: Partial<ModelsGetPublicModels200Item>) => {
  if (model.creatorId) {
    void router.push({ name: "model", params: { modelName: "custom", customModelId: model.id } })
  } else {
    void router.push({ name: "model", params: { modelName: model.slug } })
  }
}
watch(
  filter,
  () => {
    console.log("filter modified")
    modelsStore.filter.tag = filter.tag
    // match(filter.type)
    //   .with("all", () => (modelsStore.filter.tags = []))
    //   .with("image", () => (modelsStore.filter.tags = ["Image"]))
    //   .with("video", () => (modelsStore.filter.tags = ["Video"]))
  },
  { immediate: true },
)

const selectTag = (tag: ModelTags) => {
  filter.tag = filter.tag === tag ? null : tag
}
</script>
