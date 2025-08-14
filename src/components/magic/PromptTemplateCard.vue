<template lang="pug">
div.template-item.cursor-pointer(:class="itemClass" @click="$emit('click')")
  q-img(
    v-if="imageUrl"
    :src="imageUrl"
    :ratio="3/5"
    position="top"
    no-spinner
    placeholder-src="/blankAvatar.png"
    style="border-radius: 8px; overflow: hidden"
  )
  // Fallback when no preview
  div(v-else class="fallback-thumb flex column items-center justify-center")
    q-icon(name="image" size="42px" color="grey-6")
    //- p.text-grey-5.q-mt-xs {{ template.name }}
  // Title overlay
  div.title-overlay(v-if="!noTitle")
    span {{ template.name.split("—")[0] }}
    span {{ template.name.split("—")[1] }}
  // Selected overlay
  q-icon.selected-check(
    v-if="selected"
    name="check_circle"
    size="32px"
    color="primary"
  )
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { PromptTemplate, Gender } from "src/lib/promptTemplates"

const props = withDefaults(
  defineProps<{
    template: PromptTemplate
    gender: Gender
    selectable?: boolean
    selected?: boolean
    noTitle?: boolean
  }>(),
  { selectable: true, selected: false, noTitle: false },
)

defineEmits<{
  (e: "click"): void
}>()

const itemClass = computed(() => ({
  selected: props.selected,
  disabled: props.selectable === false,
}))

// Prefer already-resolved previewUrl when available; otherwise pick gendered preview
const imageUrl = computed(() => {
  const t: any = props.template
  const direct = t.previewUrl
  if (direct) return direct
  const male = t.previewUrlMale || null
  const female = t.previewUrlFemale || null
  const primary = props.gender === "male" ? male : female
  const secondary = props.gender === "male" ? female : male
  return primary || secondary || ""
})
</script>

<style scoped>
.template-item {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: #1b1b1b;
  min-height: 150px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition:
    transform 0.12s ease,
    border-color 0.12s ease;
}
.template-item:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.14);
}
.template-item.selected {
  outline: 2px solid var(--q-primary);
  border-color: var(--q-primary);
}
.fallback-thumb {
  padding: 18px;
  height: 100%;
}
.title-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 10px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.35), transparent);
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.selected-check {
  position: absolute;
  top: 8px;
  right: 8px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
}
</style>
