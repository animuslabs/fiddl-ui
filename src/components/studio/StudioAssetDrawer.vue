<template lang="pug">
transition(name="fade")
  aside.studio-asset-drawer(:class="{ 'is-mobile': isMobile }" v-if="open")
    header.row.items-center.justify-between.q-px-md.q-pt-md
      .text-subtitle1 Assets
      q-btn(flat dense round icon="close" @click="$emit('close')")
    section.q-pa-md
      q-uploader(
        accept="image/*"
        label="Upload"
        square
        flat
        bordered
        :auto-expand="false"
        @added="$emit('upload', $event)"
      )
    q-separator(dark inset)
    q-list(dense padding)
      template(v-if="assets.length")
        q-item(clickable v-for="asset in assets" :key="asset.id" @click="$emit('select-asset', asset)")
          q-item-section(avatar)
            q-img(:src="asset.thumbnail" alt="asset thumbnail" contain ratio="1")
          q-item-section
            .text-body2 {{ asset.label }}
            .text-caption.text-grey-6 {{ asset.meta }}
      template(v-else)
        .q-pa-md.text-caption.text-grey-5 No saved assets yet
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"

interface StudioAssetItem {
  id: string
  label: string
  thumbnail: string
  meta?: string
}

export default defineComponent({
  name: "StudioAssetDrawer",
  props: {
    open: {
      type: Boolean,
      default: true,
    },
    assets: {
      type: Array as PropType<StudioAssetItem[]>,
      default: () => [],
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close", "upload", "select-asset"],
})
</script>

<style scoped>
.studio-asset-drawer {
  width: 260px;
  max-width: 80vw;
  height: 100%;
  background: rgba(24, 24, 24, 0.9);
  color: white;
  display: flex;
  flex-direction: column;
}

.studio-asset-drawer.is-mobile {
  position: absolute;
  z-index: 15;
  top: 0;
  bottom: 0;
  left: 0;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
