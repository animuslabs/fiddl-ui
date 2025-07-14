<template lang="pug">
  div.relative-position(@touchstart="start" @touchmove="move" @touchend="end")
    transition(name="fade")
      q-linear-progress.absolute-top.full-width.image-darken(v-if="viewer.imgLoading" indeterminate color="primary" track-color="transparent" style="top:-2px;")
    img.image-darken(:src="viewer.currentLg" ref="overlay" :class="viewer.imgLoading ? 'image-darken active' : 'image-darken'" @click.native.stop="tap" @load="loaded" :style="{transform:`translateX(${deltaX}px)`,width:'100%',maxHeight:'75vh',objectFit:'contain'}")
  </template>

<script lang="ts" setup>
import { ref } from "vue"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
const viewer = useMediaViewerStore()
const startX = ref(0)
const deltaX = ref(0)
const swiping = ref(false)
const threshold = 50

function start(e: TouchEvent) {
  if (!e.changedTouches[0]) return
  startX.value = e.changedTouches[0].clientX
  swiping.value = true
}
function move(e: TouchEvent) {
  if (!swiping.value || !e.changedTouches[0]) return
  deltaX.value = e.changedTouches[0].clientX - startX.value
}
function end() {
  if (!swiping.value) return
  if (Math.abs(deltaX.value) > threshold) {
    if (deltaX.value > 0) viewer.prev()
    else viewer.next()
  }
  deltaX.value = 0
  swiping.value = false
}
function tap(e: MouseEvent) {
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  if (e.clientX - rect.left < rect.width / 2) viewer.prev()
  else viewer.next()
}
function loaded() {
  viewer.imgLoading = false
}
</script>

<style scoped>
.fade-enter-active {
  transition: opacity 0.5s ease 0.5s;
}
.fade-enter {
  opacity: 0;
}
.fade-enter-to {
  opacity: 1;
}
.image-darken {
  background: transparent;
  transition: filter 0.3s ease;
}
.image-darken.active {
  filter: blur(3px) brightness(50%) saturate(50%);
}
</style>
