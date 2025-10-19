<template lang="pug">
.simple-grid(:style="{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: gap }")
  .grid-item(v-for="(m, idx) in items" :key="m.id")
    q-img(
      :src="imageCurrentUrl[m.id] || m.url"
      :key="imageReloadKey[m.id]"
      :fit="objectFit"
      :position="objectPosition"
      :ratio="undefined"
      spinner-color="white"
      style="width:100%; display:block; background:#000; border-radius:0px;"
      @error="onImgError(m.id)"
      @click="$emit('selectedIndex', idx)"
    )
    .actions(style="border-radius: 24px;")
      slot(name="actions" :media="m" :index="idx")
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue"
import { useQuasar } from "quasar"
import { img } from "src/lib/netlifyImg"
import type { ImageSize } from "fiddl-server/dist/lib/types/serverTypes"

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

// Progressive image state (mirrors MediaGallery behavior in a simpler form)
const imageCurrentUrl = ref<Record<string, string>>({})
const imageReloadKey = ref<Record<string, number>>({})
const imageTargetSize = ref<Record<string, ImageSize>>({})
const imageCurrentSize = ref<Record<string, ImageSize>>({})
const imageUpgradeQueue = ref<Record<string, ImageSize[]>>({})
const imageUpgradeAttempts = ref<Record<string, Partial<Record<ImageSize, number>>>>({})
const imageUpgradeInFlight = ref<Record<string, boolean>>({})
let imageUpgradeTimer: number | null = null
const UPGRADE_INTERVAL_MS = 2000
const MAX_ATTEMPTS_PER_SIZE = 30

function pruneInactiveState(activeIds: Set<string>) {
  const pruneRecord = (record: Record<string, unknown>) => {
    for (const key of Object.keys(record)) {
      if (!activeIds.has(key)) {
        delete record[key]
      }
    }
  }
  pruneRecord(imageCurrentUrl.value)
  pruneRecord(imageReloadKey.value)
  pruneRecord(imageTargetSize.value)
  pruneRecord(imageCurrentSize.value)
  pruneRecord(imageUpgradeQueue.value as Record<string, unknown>)
  pruneRecord(imageUpgradeAttempts.value as Record<string, unknown>)
  pruneRecord(imageUpgradeInFlight.value as Record<string, unknown>)
}

watch(
  () => props.media.map((m) => `${m.id}:${m.url}`).join(","),
  () => {
    // Initialize state for new items
    for (const m of props.media) {
      if (!imageCurrentUrl.value[m.id]) imageCurrentUrl.value[m.id] = m.url
      initImageProgressState(m.id, (imageCurrentUrl.value[m.id] || m.url) as string)
    }
    pruneInactiveState(new Set(props.media.map((m) => m.id)))
    ensureImageUpgradeTimer()
  },
  { immediate: true },
)

function onImgError(id: string) {
  const curSize = imageCurrentSize.value[id] || extractSizeFromUrl(imageCurrentUrl.value[id] || "") || ("lg" as ImageSize)
  const target = imageTargetSize.value[id] || curSize
  if (curSize !== "sm") {
    if (!imageUpgradeQueue.value[id]) {
      imageUpgradeQueue.value[id] = target === "lg" ? (["md", "lg"] as ImageSize[]) : target === "md" ? (["md"] as ImageSize[]) : ([] as ImageSize[])
      imageUpgradeAttempts.value[id] = {}
    }
    imageCurrentUrl.value[id] = img(id, "sm") + cacheBust()
    imageCurrentSize.value[id] = "sm"
    imageReloadKey.value[id] = Date.now()
    ensureImageUpgradeTimer()
  }
}

function ensureImageUpgradeTimer() {
  if (imageUpgradeTimer !== null) return
  imageUpgradeTimer = window.setInterval(runImageUpgradeTick, UPGRADE_INTERVAL_MS) as unknown as number
}

onMounted(() => {
  ensureImageUpgradeTimer()
})

onUnmounted(() => {
  if (imageUpgradeTimer !== null) {
    window.clearInterval(imageUpgradeTimer)
    imageUpgradeTimer = null
  }
})

function runImageUpgradeTick() {
  try {
    if (typeof document !== "undefined" && document.hidden) return
    const now = Date.now()
    let shouldKeepAlive = false
    for (const m of props.media) {
      const id = m.id
      const queue = imageUpgradeQueue.value[id]
      if (!queue || queue.length === 0) continue
      shouldKeepAlive = true
      if (imageUpgradeInFlight.value[id]) continue
      const nextSize = queue[0] as ImageSize
      const attempts = (imageUpgradeAttempts.value[id]?.[nextSize] || 0) as number
      if (attempts >= MAX_ATTEMPTS_PER_SIZE) {
        queue.shift()
        continue
      }
      const testUrl = img(id, nextSize) + cacheBust(now)
      imageUpgradeInFlight.value[id] = true
      prefetchImage(testUrl)
        .then(() => {
          imageCurrentUrl.value[id] = img(id, nextSize) + cacheBust(now)
          imageCurrentSize.value[id] = nextSize
          imageReloadKey.value[id] = Date.now()
          queue.shift()
        })
        .catch(() => {
          const cur = imageUpgradeAttempts.value[id] || {}
          cur[nextSize] = (cur[nextSize] || 0) + 1
          imageUpgradeAttempts.value[id] = cur
        })
        .finally(() => {
          imageUpgradeInFlight.value[id] = false
        })
    }
    if (!shouldKeepAlive && imageUpgradeTimer !== null) {
      window.clearInterval(imageUpgradeTimer)
      imageUpgradeTimer = null
    }
  } catch (e) {
    console.warn("simple-grid image upgrade tick error", e)
  }
}

function extractSizeFromUrl(url: string): ImageSize | null {
  try {
    const m = url.match(/-(xs|sm|md|lg|xl)\.webp(\?.*)?$/i)
    return (m?.[1] as ImageSize) || null
  } catch {
    return null
  }
}

function initImageProgressState(id: string, url: string) {
  const size = extractSizeFromUrl(url) || ("lg" as ImageSize)
  if (!imageTargetSize.value[id]) imageTargetSize.value[id] = size
  if (!imageCurrentSize.value[id]) imageCurrentSize.value[id] = size
}

function prefetchImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    const clean = () => {
      i.onload = null
      i.onerror = null
    }
    i.onload = () => {
      clean()
      resolve()
    }
    i.onerror = () => {
      clean()
      reject(new Error("prefetch-failed"))
    }
    i.src = url
  })
}

function cacheBust(ts?: number) {
  const t = ts ?? Date.now()
  return `?cb=${t}`
}
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
