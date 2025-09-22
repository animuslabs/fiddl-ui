<template lang="pug">
q-page.studio-page
  .studio-page__container
    StudioAssetDrawer(
      :open="assetDrawerOpen"
      :assets="libraryAssets"
      :is-mobile="isMobile"
      @close="assetDrawerOpen = false"
      @select-asset="handleAssetSelect"
      @upload="handleUpload"
    )
    .studio-page__main
      StudioToolbar(
        :zoom="studio.canvas.zoom"
        :show-grid="studio.canvas.showGrid"
        :aspect-preset="studio.canvas.aspectPreset"
        :can-undo="studio.canUndo"
        :can-redo="studio.canRedo"
        :is-processing="studio.isProcessing"
        @toggle-assets="toggleAssets"
        @undo="studio.undo"
        @redo="studio.redo"
        @zoom-in="adjustZoom(0.1)"
        @zoom-out="adjustZoom(-0.1)"
        @update:aspectPreset="applyAspect"
        @update:showGrid="toggleGrid"
        @rebuild="queueRebuild"
        @export="exportCanvas"
      )
      .studio-page__body
        .studio-page__canvas-wrapper
          StudioCanvas(
            :items="studio.items"
            :selection-id="studio.selectionId || undefined"
            :canvas="studio.canvas"
            :show-grid="studio.canvas.showGrid"
            @select="studio.selectItem"
            @request-placeholder="toggleAssets"
            @update-transform="handleTransformUpdate"
          )
          StudioLayerBadge(
            v-if="studio.items.length"
            :items="studio.items"
            :selection-id="studio.selectionId || undefined"
            @select="studio.selectItem"
            @move="handleLayerMove"
          )
        transition(name="fade")
          q-card.studio-page__selection-card(flat bordered dark v-if="selectedItem")
            q-card-section
              .text-subtitle2.text-weight-medium Selected Image
              .text-caption.text-grey-5 {{ selectedItem.metadata.name || 'Untitled image' }}
            q-separator(dark inset)
            q-card-section
              .row.wrap.q-gutter-sm
                q-btn(flat dense color="primary" label="Crop" icon="crop" @click="notePending('Crop coming soon')")
                q-btn(flat dense color="primary" label="Filters" icon="tune" @click="notePending('Filter UI coming soon')")
                q-btn(flat dense color="primary" label="Mask + Describe" icon="brush" @click="notePending('Mask workflow coming soon')")
                q-btn(flat dense color="primary" label="Duplicate" icon="content_copy" @click="duplicateSelected")
                q-btn(flat dense color="negative" label="Remove" icon="delete" @click="removeSelected")
            q-card-section
              .text-caption.text-grey-5 Transform
              .q-mt-sm
                .row.items-center.justify-between.text-caption
                  span Scale
                  span {{ transformDisplay.scale.toFixed(2) }}
              q-slider(
                dense
                color="primary"
                :model-value="transformDisplay.scale"
                :min="0.2"
                :max="3"
                :step="0.01"
                @update:model-value="(val) => updateScale(val, false)"
                @change="(val) => updateScale(val, true)"
              )
              .q-mt-md
                .row.items-center.justify-between.text-caption
                  span Rotation
                  span {{ Math.round(transformDisplay.rotation) }}°
              q-slider(
                dense
                color="primary"
                :model-value="transformDisplay.rotation"
                :min="-180"
                :max="180"
                :step="1"
                @update:model-value="(val) => updateRotation(val, false)"
                @change="(val) => updateRotation(val, true)"
              )
            q-card-section
              StudioInspector(
                :key="selectedItem.id"
                :item="selectedItem"
                :loading="selectedItem.status === 'processing'"
                @update-edits="handleEditsUpdate"
                @request-edit="requestItemEdit"
              )
      StudioOutputDrawer(
        :outputs="studio.outputs"
        :open="outputDrawerOpen"
        @toggle="outputDrawerOpen = !outputDrawerOpen"
        @add-to-canvas="addOutputToCanvas"
        @download="downloadOutput"
        @discard="discardOutput"
      )
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from "vue"
import { useQuasar } from "quasar"
import StudioAssetDrawer from "src/components/studio/StudioAssetDrawer.vue"
import StudioToolbar from "src/components/studio/StudioToolbar.vue"
import StudioCanvas from "src/components/studio/StudioCanvas.vue"
import StudioLayerBadge from "src/components/studio/StudioLayerBadge.vue"
import StudioOutputDrawer from "src/components/studio/StudioOutputDrawer.vue"
import StudioInspector from "src/components/studio/StudioInspector.vue"
import { requestFluxKontextEdit } from "src/lib/ai/fluxKontext"
import { useStudioStore, type StudioItem, type StudioOutputEntry, type StudioTransformUpdatePayload } from "src/stores/studioStore"

type TransformKind = "move" | "scale" | "rotate"

interface TransformEventPayload {
  id: string
  transform: StudioTransformUpdatePayload
  commit: boolean
  kind: TransformKind
}

interface EditsUpdatePayload {
  updates: Partial<StudioItem['edits']>
  commit?: boolean
}

export default defineComponent({
  name: "StudioPage",
  components: {
    StudioAssetDrawer,
    StudioToolbar,
    StudioCanvas,
    StudioLayerBadge,
    StudioOutputDrawer,
    StudioInspector,
  },
  setup() {
    const $q = useQuasar()
    const studio = useStudioStore()
    const createId = () => {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
      }
      return Math.random().toString(36).slice(2, 10)
    }
    const defaultEdits = () => ({
      filter: null as string | null,
      brightness: 0,
      contrast: 0,
      prompt: '',
    })

    const mockKontextRenders = [
      'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=60',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=60',
      'https://images.unsplash.com/photo-1520848315518-b991dd16a6cf?auto=format&fit=crop&w=800&q=60',
    ]
    const assetDrawerOpen = ref(!$q.screen.lt.md)
    const outputDrawerOpen = ref(!$q.screen.lt.md)
    const libraryAssets = ref([
      {
        id: "sample-1",
        label: "Sample portrait",
        thumbnail: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=200&q=60",
        meta: "Library",
      },
      {
        id: "sample-2",
        label: "Outdoor scene",
        thumbnail: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=60",
        meta: "Library",
      },
    ])

    const isMobile = computed(() => $q.screen.lt.md)

    watch(
      () => $q.screen.lt.md,
      (small) => {
        if (small) {
          assetDrawerOpen.value = false
          outputDrawerOpen.value = false
        }
      },
    )

    const selectedItem = computed(() => studio.selectedItem)

    const transformDisplay = computed(() => ({
      scale: selectedItem.value?.transform.scale ?? 1,
      rotation: selectedItem.value?.transform.rotation ?? 0,
    }))

    const transformDescriptions: Record<TransformKind, string> = {
      move: "Moved image",
      scale: "Scaled image",
      rotate: "Rotated image",
    }

    function handleTransformUpdate(payload: TransformEventPayload) {
      if (!payload) return
      const description = transformDescriptions[payload.kind] ?? "Updated transform"
      const options = payload.commit
        ? { description }
        : { description, recordHistory: false }
      studio.updateItemTransform(payload.id, payload.transform, options)
    }

    function updateScale(value: number | null, commit = false) {
      if (!studio.selectionId) return
      const clamped = Math.min(3, Math.max(0.2, (value ?? 0)))
      studio.updateItemTransform(
        studio.selectionId,
        { scale: clamped },
        commit
          ? { description: transformDescriptions.scale }
          : { recordHistory: false, description: transformDescriptions.scale },
      )
    }

    function updateRotation(value: number | null, commit = false) {
      if (!studio.selectionId) return
      const normalized = Math.max(-180, Math.min(180, (value ?? 0)))
      studio.updateItemTransform(
        studio.selectionId,
        { rotation: normalized },
        commit
          ? { description: transformDescriptions.rotate }
          : { recordHistory: false, description: transformDescriptions.rotate },
      )
    }

    function handleEditsUpdate(payload: EditsUpdatePayload) {
      if (!studio.selectionId) return
      const options = payload.commit
        ? { description: 'Adjusted edits' }
        : { recordHistory: false, description: 'Adjusted edits' }
      studio.updateItemEdits(studio.selectionId, payload.updates, options)
    }

    async function requestItemEdit() {
      const current = studio.selectedItem
      if (!current || current.status === 'processing') {
        return
      }
      const targetId = current.id
      studio.setItemStatus(targetId, 'processing')
      try {
        const job = await requestFluxKontextEdit({
          itemId: targetId,
          prompt: current.edits.prompt,
          edits: {
            filter: current.edits.filter,
            brightness: current.edits.brightness,
            contrast: current.edits.contrast,
          },
        })
        $q.notify({ color: 'info', message: 'Flux Kontext is working on your edit…' })
        const eta = job.etaMs ?? 1500
        setTimeout(() => {
          const src = mockKontextRenders[Math.floor(Math.random() * mockKontextRenders.length)] as string
          studio.appendOutput({
            id: createId(),
            src,
            createdAt: Date.now(),
            sourceItemIds: [targetId],
          })
          studio.setItemStatus(targetId, 'idle')
          $q.notify({ color: 'positive', message: 'Edit complete — check Recent Outputs.' })
        }, eta)
      } catch (error) {
        studio.setItemStatus(targetId, 'idle')
        $q.notify({ color: 'negative', message: 'Edit request failed. Try again.' })
        console.warn('requestItemEdit error', error)
      }
    }

    function toggleAssets() {
      assetDrawerOpen.value = !assetDrawerOpen.value
    }

    function adjustZoom(delta: number) {
      const next = Math.min(3, Math.max(0.25, studio.canvas.zoom + delta))
      studio.updateCanvas({ zoom: next }, "Adjusted zoom")
    }

    function applyAspect(value: string) {
      studio.updateCanvas({ aspectPreset: value as any }, "Changed aspect")
    }

    function toggleGrid(value: boolean) {
      studio.updateCanvas({ showGrid: value }, "Toggled grid")
    }

    function queueRebuild() {
      studio.setProcessing(true)
      setTimeout(() => {
        const mock: StudioOutputEntry = {
          id: createId(),
          src: "https://images.unsplash.com/photo-1526178612293-94b5a8e2c45b?auto=format&fit=crop&w=800&q=60",
          createdAt: Date.now(),
          sourceItemIds: studio.items.map((item) => item.id),
        }
        studio.appendOutput(mock)
        studio.setProcessing(false)
        outputDrawerOpen.value = true
      }, 800)
    }

    function exportCanvas() {
      $q.notify({ color: "primary", message: "Export flow coming soon" })
    }

    function handleAssetSelect(asset: { id: string; thumbnail: string; label: string }) {
      const item: StudioItem = {
        id: createId(),
        src: asset.thumbnail,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        visible: true,
        metadata: {
          name: asset.label,
          origin: "library",
          createdAt: Date.now(),
        },
        edits: defaultEdits(),
        status: 'idle',
      }
      studio.addItem(item, "Placed library asset")
      if (isMobile.value) assetDrawerOpen.value = false
    }

    function handleUpload(payload: File[] | { files: File[] }) {
      const incoming = Array.isArray(payload) ? payload : payload?.files
      if (!incoming?.length) return
      incoming.forEach((file) => {
        const url = URL.createObjectURL(file)
        const item: StudioItem = {
          id: createId(),
          src: url,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          visible: true,
          metadata: {
            name: file.name,
            origin: "upload",
            createdAt: Date.now(),
          },
          edits: defaultEdits(),
          status: 'idle',
        }
        studio.addItem(item, "Uploaded image")
      })
      if (isMobile.value) assetDrawerOpen.value = false
    }

    function handleLayerMove(payload: { id: string; direction: "up" | "down" }) {
      const ids = studio.items.map((item) => item.id)
      const currentIndex = ids.indexOf(payload.id)
      if (currentIndex === -1) return
      const swapWith = payload.direction === "up" ? currentIndex + 1 : currentIndex - 1
      if (swapWith < 0 || swapWith >= ids.length) return
      const tmp = ids[currentIndex]
      ids[currentIndex] = ids[swapWith]!
      ids[swapWith] = tmp!
      studio.reorderItems(ids, "Reordered layers")
    }

    function addOutputToCanvas(output: StudioOutputEntry) {
      const item: StudioItem = {
        id: createId(),
        src: output.src,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        visible: true,
        metadata: {
          name: "Rendered output",
          origin: "generation",
          createdAt: Date.now(),
        },
        edits: defaultEdits(),
        status: 'idle',
      }
      studio.addItem(item, "Added output to canvas")
    }

    function discardOutput(output: StudioOutputEntry) {
      studio.removeOutput(output.id)
    }

    function downloadOutput(output: StudioOutputEntry) {
      if (typeof window !== 'undefined') {
        window.open(output.src, '_blank')
      } else {
        console.info('Download requested', output.src)
      }
    }

    function duplicateSelected() {
      if (!studio.selectedItem) return
      const duplicate: StudioItem = {
        ...studio.selectedItem,
        id: createId(),
        transform: {
          ...studio.selectedItem.transform,
          x: studio.selectedItem.transform.x + 24,
          y: studio.selectedItem.transform.y + 24,
        },
        metadata: {
          ...studio.selectedItem.metadata,
          name: `${studio.selectedItem.metadata.name || "Duplicate"} copy`,
          createdAt: Date.now(),
        },
        edits: { ...studio.selectedItem.edits },
        status: 'idle',
      }
      studio.addItem(duplicate, "Duplicated item")
    }

    function removeSelected() {
      if (!studio.selectionId) return
      studio.removeItem(studio.selectionId, "Removed selected item")
    }

    function addDemoItem() {
      if (studio.items.length) return
      const demo: StudioItem = {
        id: createId(),
        src: "https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?auto=format&fit=crop&w=800&q=60",
        transform: { x: -80, y: -40, scale: 0.8, rotation: -6 },
        visible: true,
        metadata: {
          name: "Demo subject",
          origin: "library",
          createdAt: Date.now(),
        },
        edits: defaultEdits(),
        status: 'idle',
      }
      const demo2: StudioItem = {
        id: createId(),
        src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=60",
        transform: { x: 80, y: 20, scale: 0.9, rotation: 8 },
        visible: true,
        metadata: {
          name: "Supporting image",
          origin: "library",
          createdAt: Date.now(),
        },
        edits: defaultEdits(),
        status: 'idle',
      }
      studio.addItem(demo, "Seed demo item")
      studio.addItem(demo2, "Seed demo item")
    }

    function addDemoOutputs() {
      if (studio.outputs.length) return
      const sample: StudioOutputEntry = {
        id: createId(),
        src: "https://images.unsplash.com/photo-1549880181-56a44cf4a9a7?auto=format&fit=crop&w=800&q=60",
        createdAt: Date.now(),
        sourceItemIds: studio.items.map((item) => item.id),
      }
      studio.appendOutput(sample)
    }

    function notePending(message: string) {
      $q.notify({ color: "secondary", message })
    }

    onMounted(() => {
      addDemoItem()
      addDemoOutputs()
    })

    return {
      studio,
      isMobile,
      assetDrawerOpen,
      outputDrawerOpen,
      libraryAssets,
      selectedItem,
      transformDisplay,
      handleTransformUpdate,
      updateScale,
      updateRotation,
      handleEditsUpdate,
      requestItemEdit,
      toggleAssets,
      adjustZoom,
      applyAspect,
      toggleGrid,
      queueRebuild,
      exportCanvas,
      handleAssetSelect,
      handleUpload,
      handleLayerMove,
      addOutputToCanvas,
      discardOutput,
      downloadOutput,
      duplicateSelected,
      removeSelected,
      notePending,
    }
  },
})
</script>

<style scoped>
.studio-page {
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.05), transparent 58%), #080808;
  color: white;
  padding: 24px 16px 0;
}

.studio-page__container {
  display: flex;
  gap: 16px;
  position: relative;
}

.studio-page__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.studio-page__body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
}

.studio-page__canvas-wrapper {
  position: relative;
  flex: 1;
  display: flex;
}

.studio-page__selection-card {
  width: 260px;
  align-self: flex-start;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1023px) {
  .studio-page {
    padding: 12px;
  }

  .studio-page__container {
    flex-direction: column;
  }

  .studio-page__body {
    flex-direction: column;
  }

  .studio-page__selection-card {
    width: 100%;
  }
}
</style>
