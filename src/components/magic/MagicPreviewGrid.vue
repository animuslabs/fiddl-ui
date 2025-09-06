<template lang="pug">
.full-width.bg-blur.q-pa-lg(style="max-width:720px;")
  .template-preview-grid(:style="gridStyle")
    template(v-if="templates && templates.length > 0")
      .template-item(v-for="t in templates" :key="`${t.id}-${t.name}`")
        .template-card-box
          PromptTemplateCard(:template="t" :gender="gender || 'female'" :selectable="false" :ratio="isDesktop ? 3/5 : 1")
          span.reactive-ghost(v-if="showNameGhost && t?.name") {{ t.name[0] }}
    template(v-else)
      .template-item(v-for="i in skeletonCount" :key="i")
        q-skeleton(type="rect" style="width:100%; aspect-ratio:3/4; border-radius:8px;")

  .row.items-center.justify-center.q-mt-md
    q-spinner-dots(v-if="showSpinner" color="primary" size="24px")
    span.text-primary.q-ml-sm {{ loadingMessage }}
</template>

<script setup lang="ts">
import { computed } from "vue"
import PromptTemplateCard from "src/components/magic/PromptTemplateCard.vue"
import type { PromptTemplate, Gender } from "src/lib/promptTemplates"

const props = defineProps<{
  templates: PromptTemplate[]
  loadingMessage: string
  skeletonCount?: number
  isDesktop: boolean
  gender?: Gender | null
  showSpinner?: boolean
  showNameGhost?: boolean
}>()

const gridStyle = computed(() => ({
  display: "grid",
  gridTemplateColumns: props.isDesktop ? "repeat(auto-fit, minmax(140px, 1fr))" : "repeat(3, minmax(0, 1fr))",
  gap: props.isDesktop ? "10px" : "6px",
  justifyItems: "center",
  marginLeft: "auto",
  marginRight: "auto",
  width: "100%",
  maxWidth: "100%",
}))

const skeletonCount = computed(() => Math.max(1, Math.min(3, props.skeletonCount || 3)))
const showSpinner = computed(() => props.showSpinner !== false)
</script>

<style scoped>
.template-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  justify-items: center;
  justify-content: center;
  align-content: center;
  width: 100%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}
.template-card-box {
  aspect-ratio: 3/5;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  display: block;
  max-width: 240px;
  margin: 0 auto;
}
@media (min-width: 1024px) {
  .template-card-box {
    max-width: 260px;
  }
}
.template-item {
  width: 100%;
  min-width: 0;
}
.template-item :deep(.q-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-self: center;
}
.template-item :deep(h6),
.template-item :deep(.title),
.template-item :deep(.q-card__section) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 599px) {
  .template-card-box {
    /* Match the mobile q-img ratio to avoid clipping content */
    aspect-ratio: 1 / 1;
  }
}
</style>
