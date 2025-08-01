<template lang="pug">
q-page.absolute-position
  div(style="position:sticky; top:50px; z-index:10;").bg-blur-light
    .centered
      h3.relative-position {{modelsStore.filter.tag||"All"}} Models
        q-btn.absolute-left( style="left:-60px" v-if="modelsStore.filter.tag" icon="close"  color="secondary" flat @click="modelsStore.filter.tag = null")
    .chip-strip.q-mb-md(ref="chipScrollContainer").q-pb-xs.q-pt-xs
      .tag-pill.cursor-pointer(
        v-for="tag in modelTags"
        :key="tag"
        :id="'chip-' + tag"
        :text-color="modelsStore.filter.tag === tag ? 'black' : 'white'"
        @click="selectTag(tag)"
        style="height:35px;"
        :class="modelsStore.filter.tag === tag ? 'bg-accent' : 'bg-grey-10'"
        clickable
      )
        p {{ tag }}
  .row.q-ma-md(style="z-index:-5")
    .col-12.col-sm-6.col-md-4.col-lg-3(v-for="model in modelsStore.allModels.value" :key="model.slug")
      ModelCard.q-ma-sm( selectable :model="model" :key="model.slug+model.name" @chipClick="selectTag" @click="toModelPage(model)")
  //- .centered
    q-btn(label="reload" @click="modelsStore.loadAllModels()")
  //- pre {{ modelsStore.loading }}
  //- pre {{ modelsStore.filteredBaseModels }}
  //- q-separator(color="grey-8")



</template>

<script setup lang="ts">
import { modelTags, type ModelTags } from "lib/imageModels"
import type { MediaType } from "lib/types"
import { watch, nextTick, getCurrentInstance, ref } from "vue"
import ModelCard from "components/ModelCard.vue"
import * as modelsStore from "stores/modelsStore"
import { match } from "ts-pattern"
import { useRoute, useRouter } from "vue-router"
import { type ModelsGetPublicModels200Item } from "lib/orval"

const router = useRouter()
const route = useRoute()

const scrollSelectedChipIntoView = () => {
  void nextTick(() => {
    const tag = modelsStore.filter.tag
    if (tag) {
      const chipEl = document.getElementById("chip-" + tag)
      if (chipEl) {
        chipEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  })
}

const toModelPage = (model: Partial<ModelsGetPublicModels200Item>) => {
  if (model.id) {
    void router.push({ name: "model", params: { modelName: "custom", customModelId: model.id } })
  } else {
    void router.push({ name: "model", params: { modelName: model.slug } })
  }
}
watch(
  () => route.params,
  () => {
    if (route.params.filterTag) modelsStore.filter.tag = route.params.filterTag as ModelTags
    else modelsStore.filter.tag = null
    scrollSelectedChipIntoView()
  },
  { immediate: true },
)
watch(
  () => modelsStore.filter.tag,
  () => {
    console.log("filter modified")
    void router.replace({ name: "models", params: { filterTag: modelsStore.filter.tag } })
    scrollSelectedChipIntoView()
  },
  { immediate: true },
)

const selectTag = (tag: ModelTags) => {
  // void router.replace({ name: "models", params: { filterTag: tag } })
  console.log(tag)
  modelsStore.filter.tag = modelsStore.filter.tag === tag ? null : tag
  void nextTick(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    window.scroll({ behavior: "smooth", top: 0 })
    scrollSelectedChipIntoView()
  })
}

// On mount, scroll to selected chip if any
void nextTick(() => {
  scrollSelectedChipIntoView()
})
</script>
