import { reactive, computed } from "vue"

function createInitialState() {
  return {
    files: [] as File[],
    isUploading: false,
  }
}

const state = reactive(createInitialState())

function addFiles(newFiles: File[]) {
  state.files.push(...newFiles)
}

function clearFiles() {
  state.files = []
}

const totalSizeMB = computed(() => state.files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024)

export function useForgeStore() {
  return {
    state,
    addFiles,
    clearFiles,
    totalSizeMB,
    reset: resetForgeState,
  }
}

export function resetForgeState() {
  Object.assign(state, createInitialState())
}
