<template lang="pug">
q-page.absolute-position
  div.bg-grey-10(style="position:sticky; top:50px;")
    .centered
      h2 Models
    //- q-separator(color="grey-8" spaced)
    div.q-mb-md.bg-grey-10.q-pt-sm.q-pb-xs( style="overflow-y: hidden; scrollbar-width: none;")
      .row.no-wrap.items-center.q-gutter-md
        q-chip.cursor-pointer(
          v-for="tag in modelTags"
          :key="tag"
          clickable
          :color="filter.tag === tag ? 'accent' : 'grey-9'"
          :text-color="filter.tag === tag ? 'black' : 'white'"
          @click="selectTag(tag)"
          style="height:35px;"
        )
          h4 {{ tag }}
  //- .centered
    q-btn(label="reload" @click="modelsStore.loadAllModels()")
  pre {{ modelsStore.loading }}
  pre {{ modelsStore.filteredBaseModels }}
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

import * as modelsStore from "stores/modelsStore"
import { match } from "ts-pattern"
const filter = reactive({
  type: "all" as MediaType | "all",
  tag: null as ModelTags | null,
})

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
