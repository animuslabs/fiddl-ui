import { sleep } from "lib/util"
import { reactive, computed } from "vue"

function createInitialState() {
  return {
    files: [] as File[],
    fileUrls: {} as Record<string, string>,
    isUploading: false,
  }
}

const state = reactive(createInitialState())

async function addFiles(newFiles: File[]) {
  const existing = state.files.slice()
  state.files = existing.concat(newFiles)
  for (const file of newFiles) {
    await sleep(30)
    state.fileUrls[file.name] = URL.createObjectURL(file)
  }
}

function clearFiles() {
  state.files = []
  state.fileUrls = {}
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
