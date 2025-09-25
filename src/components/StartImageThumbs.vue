<template lang="pug">
.thumb-grid(:style="{ gap: gapPx }")
  .thumb-item(v-for="item in items" :key="item.source + ':' + item.id" :style="thumbStyle")
    q-img(:src="srcFor(item)" :ratio="1" :img-style="{ objectFit: 'cover', borderRadius: radiusCss }" style="width:100%; height:100%")
    q-btn.delete-btn(round dense flat icon="close" @click.stop="$emit('remove', item)" :size="closeSize")
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { compressedUrl } from 'lib/imageCdn'
import { s3Img } from 'lib/netlifyImg'

type StartImageItem = { id: string; source: 'uploaded' | 'existing' }

const props = withDefaults(defineProps<{
  items: StartImageItem[]
  size?: number // square size in px
  radius?: number // corner radius
  gap?: number
}>(), {
  size: 64,
  radius: 8,
  gap: 8,
})

defineEmits<{ (e: 'remove', item: StartImageItem): void }>()

const thumbStyle = computed(() => ({ width: props.size + 'px', height: props.size + 'px' }))
const radiusCss = computed(() => props.radius + 'px')
const gapPx = computed(() => props.gap + 'px')
const closeSize = computed(() => (props.size <= 56 ? 'xs' : 'sm'))

function srcFor(item: StartImageItem): string {
  if (item.source === 'uploaded') return s3Img('uploads/' + item.id)
  // choose larger compressed image for larger tiles
  return compressedUrl(item.id, props.size > 64 ? 'md' : 'sm')
}
</script>

<style scoped>
.thumb-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.thumb-item {
  position: relative;
}
.delete-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  background: rgba(0, 0, 0, 0.6);
}
</style>

