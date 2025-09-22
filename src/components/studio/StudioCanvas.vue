<template lang="pug">
div.studio-canvas(@click="resetSelection")
  div.studio-canvas__work-area(
    :class="{ 'with-grid': showGrid }"
    ref="workArea"
    :style="workAreaStyle"
    @click.stop
  )
    div.studio-canvas__frame(:style="frameStyle")
      button.studio-canvas__add(v-if="!items.length" @click.stop="$emit('request-placeholder')")
        q-icon(name="add" class="q-mr-sm")
        | Add an image to get started
      div(
        v-for="item in items"
        :key="item.id"
        v-show="item.visible"
        class="studio-canvas__item"
        :class="{'is-selected': item.id === selectionId, 'is-dragging': draggingId === item.id}"
        :style="itemStyle(item)"
        @click.stop="select(item.id)"
        @pointerdown.prevent="startDrag($event, item)"
      )
        q-img(:src="item.src" :alt="item.metadata.name" no-spinner)
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, PropType, ref } from "vue"
import type { StudioItem, StudioCanvasState } from "src/stores/studioStore"

interface DragState {
  id: string
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  latestX: number
  latestY: number
}

export default defineComponent({
  name: "StudioCanvas",
  props: {
    items: {
      type: Array as PropType<StudioItem[]>,
      default: () => [],
    },
    selectionId: {
      type: String,
      default: null,
    },
    canvas: {
      type: Object as PropType<StudioCanvasState>,
      required: true,
    },
    showGrid: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["select", "request-placeholder", "update-transform"],
  setup(props, { emit }) {
    const dragState = ref<DragState | null>(null)
    const workArea = ref<HTMLDivElement | null>(null)

    const frameStyle = computed(() => {
      const { aspectPreset } = props.canvas
      const ratios: Record<string, number> = {
        "1:1": 1,
        "3:4": 3 / 4,
        "4:3": 4 / 3,
        "16:9": 16 / 9,
        "9:16": 9 / 16,
      }
      const ratio = ratios[aspectPreset] ?? 1
      const paddingPercentage = (1 / ratio) * 100
      return {
        paddingBottom: `${paddingPercentage}%`,
      }
    })

    const workAreaStyle = computed(() => {
      if (props.canvas.zoom === 1) return {}
      return {
        transform: `scale(${props.canvas.zoom})`,
      }
    })

    const draggingId = computed(() => dragState.value?.id ?? null)

    function select(id: string) {
      emit("select", id)
    }

    function resetSelection() {
      emit("select", null)
    }

    function itemStyle(item: StudioItem) {
      const { transform } = item
      const centre = "translate(-50%, -50%)"
      const translate = `translate(${transform.x}px, ${transform.y}px)`
      const rotate = `rotate(${transform.rotation}deg)`
      const scale = `scale(${transform.scale})`
      return {
        transform: `${centre} ${translate} ${rotate} ${scale}`,
      }
    }

    function startDrag(event: PointerEvent, item: StudioItem) {
      if (event.button !== undefined && event.button !== 0) return
      select(item.id)
      const state: DragState = {
        id: item.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: item.transform.x,
        originY: item.transform.y,
        latestX: item.transform.x,
        latestY: item.transform.y,
      }
      dragState.value = state
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", endDrag)
      window.addEventListener("pointercancel", endDrag)
      event.preventDefault()
    }

    function handlePointerMove(event: PointerEvent) {
      const state = dragState.value
      if (!state || event.pointerId !== state.pointerId) return
      const zoom = props.canvas.zoom || 1
      const dx = (event.clientX - state.startX) / zoom
      const dy = (event.clientY - state.startY) / zoom
      state.latestX = state.originX + dx
      state.latestY = state.originY + dy
      emit("update-transform", {
        id: state.id,
        transform: { x: state.latestX, y: state.latestY },
        commit: false,
        kind: "move",
      })
    }

    function endDrag(event: PointerEvent) {
      const state = dragState.value
      if (!state || event.pointerId !== state.pointerId) return
      const moved = Math.abs(state.originX - state.latestX) > 0.5 || Math.abs(state.originY - state.latestY) > 0.5
      if (moved) {
        emit("update-transform", {
          id: state.id,
          transform: { x: state.latestX, y: state.latestY },
          commit: true,
          kind: "move",
        })
      }
      cleanup()
    }

    function cleanup() {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
      dragState.value = null
    }

    onBeforeUnmount(() => {
      cleanup()
    })

    return {
      frameStyle,
      workAreaStyle,
      workArea,
      select,
      resetSelection,
      itemStyle,
      startDrag,
      draggingId,
    }
  },
})
</script>

<style scoped>
.studio-canvas {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.studio-canvas__work-area {
  position: relative;
  width: min(100%, 1080px);
  min-height: 320px;
  background: rgba(20, 20, 20, 0.85);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transform-origin: center;
}

.studio-canvas__work-area.with-grid {
  background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 1px,
      transparent 1px
    ),
    linear-gradient(
      rgba(255, 255, 255, 0.05) 1px,
      transparent 1px
    );
  background-size: 40px 40px;
}

.studio-canvas__frame {
  position: relative;
  width: 80%;
  height: 0;
  border: 2px dashed rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(12, 12, 12, 0.8);
}

.studio-canvas__frame::after {
  content: "";
  display: block;
  width: 100%;
}

.studio-canvas__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  color: white;
  font-size: 16px;
  cursor: pointer;
  padding: 32px;
}

.studio-canvas__item {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  transition: box-shadow 0.2s ease;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.4);
  cursor: grab;
  /* Ensure new items are visible and sized relative to the frame */
  width: clamp(200px, 60%, 880px);
}

.studio-canvas__item.is-selected {
  box-shadow: 0 0 0 3px var(--q-color-primary);
}

.studio-canvas__item.is-dragging {
  cursor: grabbing;
}

.studio-canvas__item :deep(.q-img) {
  display: block;
  width: 100%;
  height: auto;
}
</style>
