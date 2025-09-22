import { defineStore } from "pinia"

export type StudioAspectPreset = "1:1" | "3:4" | "4:3" | "16:9" | "9:16"

export interface StudioCanvasState {
  width: number
  height: number
  aspectPreset: StudioAspectPreset
  zoom: number
  showGrid: boolean
}

export interface StudioItemTransform {
  x: number
  y: number
  scale: number
  rotation: number
}

export interface StudioItemEdits {
  filter: string | null
  brightness: number
  contrast: number
  prompt: string
}

export interface StudioItemMetadata {
  name: string
  origin: "upload" | "library" | "generation"
  createdAt: number
}

export type StudioItemStatus = "idle" | "processing"

export interface StudioItem {
  id: string
  src: string
  transform: StudioItemTransform
  visible: boolean
  metadata: StudioItemMetadata
  edits: StudioItemEdits
  status: StudioItemStatus
}

export type StudioTransformUpdatePayload = Partial<StudioItemTransform>

interface UpdateOptions {
  recordHistory?: boolean
  description?: string
}

export interface StudioOutputEntry {
  id: string
  src: string
  createdAt: number
  sourceItemIds: string[]
}

interface HistoryEntry {
  snapshot: string
  description: string
}

interface StudioState {
  canvas: StudioCanvasState
  items: StudioItem[]
  selectionId: string | null
  outputs: StudioOutputEntry[]
  history: HistoryEntry[]
  historyIndex: number
  isProcessing: boolean
}

const createInitialCanvasState = (): StudioCanvasState => ({
  width: 1024,
  height: 1024,
  aspectPreset: "1:1",
  zoom: 1,
  showGrid: true,
})

const createHistoryEntry = (
  payload: Pick<StudioState, "canvas" | "items" | "selectionId">,
  description: string,
): HistoryEntry => ({
  snapshot: JSON.stringify(payload),
  description,
})

export const useStudioStore = defineStore("studio", {
  state: (): StudioState => {
    const canvas = createInitialCanvasState()
    const items: StudioItem[] = []
    const selectionId: string | null = null
    const history = [createHistoryEntry({ canvas, items, selectionId }, "Initial state")]

    return {
      canvas,
      items,
      selectionId,
      outputs: [],
      history,
      historyIndex: 0,
      isProcessing: false,
    }
  },
  getters: {
    selectedItem(state): StudioItem | undefined {
      return state.items.find((item) => item.id === state.selectionId)
    },
    canUndo(state): boolean {
      return state.historyIndex > 0
    },
    canRedo(state): boolean {
      return state.historyIndex >= 0 && state.historyIndex < state.history.length - 1
    },
  },
  actions: {
    selectItem(id: string | null) {
      this.selectionId = id
    },
    addItem(item: StudioItem, description = "Added item") {
      this.items = [...this.items, item]
      this.selectionId = item.id
      this._pushHistory(description)
    },
    updateCanvas(partial: Partial<StudioCanvasState>, description = "Updated canvas") {
      this.canvas = { ...this.canvas, ...partial }
      this._pushHistory(description)
    },
    updateItem(id: string, updates: Partial<StudioItem>, description = "Updated item") {
      const idx = this.items.findIndex((item) => item.id === id)
      if (idx === -1) return
      const items = [...this.items]
      const current = items[idx]!
      const updated = { ...current, ...updates } as StudioItem
      items[idx] = updated
      this.items = items
      this._pushHistory(description)
    },
    updateItemTransform(id: string, updates: StudioTransformUpdatePayload, options: UpdateOptions = {}) {
      const idx = this.items.findIndex((item) => item.id === id)
      if (idx === -1) return
      const items = [...this.items]
      const current = items[idx]!
      const updated: StudioItem = {
        ...current,
        transform: {
          ...current.transform,
          ...updates,
        },
      }
      items[idx] = updated
      this.items = items
      if (options.recordHistory === false) return
      const description = options.description ?? "Updated transform"
      this._pushHistory(description)
    },
    updateItemEdits(id: string, updates: Partial<StudioItemEdits>, options: UpdateOptions = {}) {
      const idx = this.items.findIndex((item) => item.id === id)
      if (idx === -1) return
      const items = [...this.items]
      const current = items[idx]!
      const updated: StudioItem = {
        ...current,
        edits: {
          ...current.edits,
          ...updates,
        },
      }
      items[idx] = updated
      this.items = items
      if (options.recordHistory === false) return
      const description = options.description ?? "Updated edits"
      this._pushHistory(description)
    },
    setItemStatus(id: string, status: StudioItemStatus) {
      const idx = this.items.findIndex((item) => item.id === id)
      if (idx === -1) return
      const items = [...this.items]
      const updated: StudioItem = { ...items[idx]!, status }
      items[idx] = updated
      this.items = items
    },
    reorderItems(idsInOrder: string[], description = "Reordered items") {
      const next: StudioItem[] = []
      idsInOrder.forEach((id) => {
        const found = this.items.find((item) => item.id === id)
        if (found) next.push(found)
      })
      if (next.length === this.items.length) {
        this.items = next
        this._pushHistory(description)
      }
    },
    removeItem(id: string, description = "Removed item") {
      this.items = this.items.filter((item) => item.id !== id)
      if (this.selectionId === id) {
        this.selectionId = this.items.at(-1)?.id ?? null
      }
      this._pushHistory(description)
    },
    appendOutput(entry: StudioOutputEntry) {
      this.outputs = [entry, ...this.outputs]
    },
    removeOutput(id: string) {
      this.outputs = this.outputs.filter((output) => output.id !== id)
    },
    setProcessing(flag: boolean) {
      this.isProcessing = flag
    },
    undo() {
      if (!this.canUndo) return
      this.historyIndex -= 1
      this._rehydrateFromHistory()
    },
    redo() {
      if (!this.canRedo) return
      this.historyIndex += 1
      this._rehydrateFromHistory()
    },
    _pushHistory(description: string) {
      const entry = createHistoryEntry(
        {
          canvas: this.canvas,
          items: this.items,
          selectionId: this.selectionId,
        },
        description,
      )
      const nextIndex = this.historyIndex + 1
      this.history = [...this.history.slice(0, nextIndex), entry]
      this.historyIndex = this.history.length - 1
    },
    _rehydrateFromHistory() {
      const entry = this.history[this.historyIndex]
      if (!entry) return
      try {
        const payload = JSON.parse(entry.snapshot) as Pick<StudioState, "canvas" | "items" | "selectionId">
        this.canvas = payload.canvas
        this.items = payload.items
        this.selectionId = payload.selectionId
        if (this.selectionId && !this.items.find((item) => item.id === this.selectionId)) {
          this.selectionId = this.items.at(-1)?.id ?? null
        }
      } catch (error) {
        console.warn("Failed to restore studio state", error)
      }
    },
  },
})
