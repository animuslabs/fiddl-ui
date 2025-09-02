<template lang="pug">
.simple-grid(:style="{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: gap }")
  .grid-item(v-for="(m, idx) in items" :key="m.id")
    q-img(
      :src="m.url"
      :fit="objectFit"
      :position="objectPosition"
      :ratio="undefined"
      spinner-color="white"
      style="width:100%; display:block; background:#000; border-radius:0px;"
      @click="$emit('selectedIndex', idx)"
    )
    .actions(style="border-radius: 24px;")
      slot(name="actions" :media="m" :index="idx")
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useQuasar } from "quasar"
export type Item = { id: string; url: string }

const props = withDefaults(
  defineProps<{
    media: Item[]
    colsDesktop?: number
    colsMobile?: number
    gap?: string
    objectFit?: "cover" | "contain"
    objectPosition?: string
  }>(),
  {
    colsDesktop: 3,
    colsMobile: 1,
    gap: "8px",
    objectFit: "contain",
    objectPosition: "center",
  },
)

const $q = useQuasar()
const cols = computed(() => ($q.screen.lt.md ? props.colsMobile : props.colsDesktop))
const gap = computed(() => props.gap)
const items = computed(() => props.media)
</script>

<style scoped>
.simple-grid {
  display: grid;
  width: 100%;
}
.grid-item {
  display: flex;
  flex-direction: column;
}
.actions {
  /* margin-top: 8px; */
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
