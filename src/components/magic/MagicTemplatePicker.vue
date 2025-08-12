<template lang="pug">
div
  .centered.q-mb-sm
    p.text-secondary Select up to {{ maxSelect }}
  //- Grid container
  .template-grid(:style="gridStyle")
    //- Template tile
    div.template-item.cursor-pointer(
      v-for="t in templates"
      :key="t.id"
      :class="itemClass(t.id)"
      @click="toggle(t.id)"
    )
      //- Thumbnail (optional)
      q-img(
        v-if="t.thumbnailId"
        :src="thumbUrl(t.thumbnailId)"
        :ratio="4/5"
        placeholder-src="/blankAvatar.png"
        no-spinner
        style="border-radius: 8px; overflow: hidden"
      )
      //- Fallback tile without thumbnail
      div(v-else class="fallback-thumb flex column items-center justify-center")
        q-icon(name="image" size="42px" color="grey-6")
        p.text-grey-5.q-mt-xs {{ t.title }}
      //- Title overlay
      div.title-overlay
        span {{ t.title }}
      //- Check overlay when selected
      q-icon.selected-check(
        v-if="isSelected(t.id)"
        name="check_circle"
        size="32px"
        color="primary"
      )
  .centered.q-mt-sm
    p.text-secondary {{ selected.length }} / {{ maxSelect }} selected
</template>

<script setup lang="ts">
import { computed } from "vue"
import { img } from "lib/netlifyImg"
import type { MagicTemplate } from "src/lib/magic/magicTemplates"

const props = withDefaults(
  defineProps<{
    templates: MagicTemplate[]
    selected: string[]
    maxSelect?: number
    disabled?: boolean
  }>(),
  { maxSelect: 3, disabled: false },
)

const emit = defineEmits<{
  (e: "update:selected", value: string[]): void
}>()

const gridStyle = computed(() => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: "10px",
}))

function isSelected(id: string) {
  return props.selected.includes(id)
}

function toggle(id: string) {
  if (props.disabled) return
  const next = [...props.selected]
  const idx = next.indexOf(id)
  if (idx >= 0) next.splice(idx, 1)
  else {
    if (next.length >= props.maxSelect) return
    next.push(id)
  }
  emit("update:selected", next)
}

function itemClass(id: string) {
  return {
    selected: isSelected(id),
    disabled: props.disabled,
  }
}

function thumbUrl(id: string) {
  // Allow future branded thumbs via S3 keys or image ids
  // If using standard image ids, this returns the large size
  return img(id, "md")
}
</script>

<style scoped>
.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
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
