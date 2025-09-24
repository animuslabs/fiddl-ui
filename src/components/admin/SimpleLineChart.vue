<template lang="pug">
.chart-container
  svg(:viewBox="`0 0 ${vbWidth} ${vbHeight}`" preserveAspectRatio="none" class="chart-svg")
    defs
      linearGradient(:id="gradientId" x1="0" y1="0" x2="0" y2="1")
        stop(offset="0%" :stop-color="gradientStart" :stop-opacity="0.35")
        stop(offset="100%" :stop-color="gradientEnd" :stop-opacity="0")
    // area fill (optional)
    path(v-if="showArea && areaPath" :d="areaPath" :fill="`url(#${gradientId})`" fill-opacity="0.6")
    // line path
    path(v-if="linePath" :d="linePath" :stroke="strokeColor" :stroke-width="strokeWidth" fill="none" stroke-linejoin="round" stroke-linecap="round")
    // draw x baseline
    line(x1="0" :y1="vbHeight - padding" :x2="vbWidth" :y2="vbHeight - padding" stroke="#E0E0E0" stroke-width="1")
    // min/max labels (optional)
    template(v-if="showAxisLabels && hasData")
      text(:x="2" :y="padding + 10" fill="#666" font-size="10") {{ maxY.toLocaleString() }}
      text(:x="2" :y="vbHeight - padding - 2" fill="#666" font-size="10") {{ minY.toLocaleString() }}
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'

type Point = { x: number; y: number }

const props = defineProps<{
  values: number[]
  labels?: string[]
  strokeColor?: string
  strokeWidth?: number
  height?: number
  padding?: number
  showArea?: boolean
  showAxisLabels?: boolean
}>()

const strokeColor = computed(() => props.strokeColor ?? '#1976d2')
const strokeWidth = computed(() => props.strokeWidth ?? 2)
const vbWidth = 1000
const vbHeight = computed(() => Math.max(60, props.height ?? 120))
const padding = computed(() => Math.max(0, props.padding ?? 16))
const hasData = computed(() => Array.isArray(props.values) && props.values.length > 0)

const gradientId = `grad-${Math.random().toString(36).slice(2, 9)}`
const gradientStart = computed(() => strokeColor.value)
const gradientEnd = computed(() => strokeColor.value)

const minY = computed(() => {
  if (!hasData.value) return 0
  const m = Math.min(...props.values)
  return Number.isFinite(m) ? m : 0
})
const maxY = computed(() => {
  if (!hasData.value) return 0
  const m = Math.max(...props.values)
  return Number.isFinite(m) ? m : 0
})

const yRange = computed(() => {
  const r = maxY.value - minY.value
  return r <= 0 ? 1 : r
})

const points = computed<Point[]>(() => {
  if (!hasData.value) return []
  const n = props.values.length
  const w = vbWidth - padding.value * 2
  const h = vbHeight.value - padding.value * 2
  if (n === 1) {
    const x = padding.value + w / 2
    const v0 = props.values[0] ?? 0
    const y = padding.value + h - ((v0 - minY.value) / yRange.value) * h
    return [{ x, y }]
  }
  return props.values.map((v, i) => {
    const x = padding.value + (i / (n - 1)) * w
    const y = padding.value + h - ((v - minY.value) / yRange.value) * h
    return { x, y }
  })
})

const linePath = computed(() => {
  if (!points.value.length) return ''
  const first = points.value[0]!
  const rest = points.value.slice(1)
  const move = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  const lines = rest.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return `${move} ${lines}`
})

const areaPath = computed(() => {
  if (!props.showArea || points.value.length < 2) return ''
  const baseY = vbHeight.value - padding.value
  const first = points.value[0]!
  const rest = points.value.slice(1)
  const move = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  const lines = rest.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const last = points.value[points.value.length - 1]!
  const close = `L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`
  return `${move} ${lines} ${close}`
})
</script>

<style scoped>
.chart-container {
  width: 100%;
}
.chart-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
