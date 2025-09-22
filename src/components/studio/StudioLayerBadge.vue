<template lang="pug">
div.studio-layer-badge
  q-btn(round dense icon="layers" color="grey-9" text-color="white" @click="menu = true")
    q-badge.rounded(floating color="primary" v-if="items.length") {{ items.length }}
  q-menu(v-model="menu" anchor="bottom middle" self="top middle")
    q-list(style="min-width:200px" dense)
      q-item(v-for="item in items" :key="item.id" clickable @click="handleSelect(item.id)" :active="item.id === selectionId")
        q-item-section(avatar)
          q-avatar(size="36px")
            q-img(:src="item.src" :alt="item.metadata.name" ratio="1" contain)
        q-item-section
          .text-body2 {{ item.metadata.name || 'Untitled' }}
          .row.items-center.q-gutter-xs
            .text-caption.text-grey-6 {{ item.metadata.origin }}
            q-badge(
              v-if="item.status === 'processing'"
              color="warning"
              text-color="black"
              label="processing"
              rounded
              size="xs"
            )
        q-item-section(side)
          q-btn(flat dense icon="arrow_upward" @click.stop="() => bump(item.id, 'up')" :disable="isTop(item.id)")
          q-btn(flat dense icon="arrow_downward" @click.stop="() => bump(item.id, 'down')" :disable="isBottom(item.id)")
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from "vue"
import type { StudioItem } from "src/stores/studioStore"

export default defineComponent({
  name: "StudioLayerBadge",
  props: {
    items: {
      type: Array as PropType<StudioItem[]>,
      default: () => [],
    },
    selectionId: {
      type: String,
      default: null,
    },
  },
  emits: ["select", "move"],
  setup(props, { emit }) {
    const menu = ref(false)

    function handleSelect(id: string) {
      emit("select", id)
      menu.value = false
    }

    function bump(id: string, direction: "up" | "down") {
      emit("move", { id, direction })
    }

    function isTop(id: string) {
      return props.items.at(-1)?.id === id
    }

    function isBottom(id: string) {
      return props.items[0]?.id === id
    }

    return {
      menu,
      handleSelect,
      bump,
      isTop,
      isBottom,
    }
  },
})
</script>

<style scoped>
.studio-layer-badge {
  position: absolute;
  right: 32px;
  top: 32px;
  z-index: 10;
}

@media (max-width: 768px) {
  .studio-layer-badge {
    right: 16px;
    top: 16px;
  }
}
</style>
