import { sleep } from "lib/util"
import { reactive, computed } from "vue"
import { modelsGetUserModels, trainingSetsGetUserSets, type ModelsGetUserModels200Item, type TrainingSetsGetUserSets200Item, modelsGetTrainingStatus, type ModelsGetTrainingStatus200 } from "lib/orval"
import { useUserAuth } from "src/stores/userAuth"

type CustomModelWithRequests = ModelsGetUserModels200Item
type TrainingSet = TrainingSetsGetUserSets200Item
type TrainingStatus = ModelsGetTrainingStatus200

const STALE_MS = 60 * 1000

function createInitialState() {
  return {
    // uploader
    files: [] as File[],
    fileUrls: {} as Record<string, string>,
    isUploading: false,

    // cached lists
    userModels: [] as CustomModelWithRequests[],
    userTrainingSets: [] as TrainingSet[],

    // loading flags
    loadingModels: false,
    loadingTrainingSets: false,

    // timestamps
    lastLoadedModelsAt: 0,
    lastLoadedTrainingSetsAt: 0,

    // per-model training status cache
    trainingStatus: {} as Record<string, { data: TrainingStatus; ts: number }>,
    loadingTrainingStatus: {} as Record<string, boolean>,
  }
}

const state = reactive(createInitialState())

// uploader
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

// caching helpers
function isStale(ts: number, maxAge = STALE_MS) {
  return Date.now() - ts > maxAge
}

async function loadUserModels(force = false) {
  if (state.loadingModels) return
  const user = useUserAuth()
  if (!user.loggedIn || !user.userId) {
    state.userModels = []
    state.lastLoadedModelsAt = Date.now()
    return
  }
  if (!force && state.userModels.length && !isStale(state.lastLoadedModelsAt)) return

  state.loadingModels = true
  try {
    const res = await modelsGetUserModels()
    state.userModels = res?.data || []
    state.lastLoadedModelsAt = Date.now()
  } catch (e) {
    state.userModels = []
  } finally {
    state.loadingModels = false
  }
}

async function loadUserTrainingSets(force = false) {
  if (state.loadingTrainingSets) return
  const user = useUserAuth()
  if (!user.loggedIn || !user.userId) {
    state.userTrainingSets = []
    state.lastLoadedTrainingSetsAt = Date.now()
    return
  }
  if (!force && state.userTrainingSets.length && !isStale(state.lastLoadedTrainingSetsAt)) return

  state.loadingTrainingSets = true
  try {
    const res = await trainingSetsGetUserSets({ userId: user.userId || "" })
    state.userTrainingSets = res?.data || []
    state.lastLoadedTrainingSetsAt = Date.now()
  } catch (e) {
    state.userTrainingSets = []
  } finally {
    state.loadingTrainingSets = false
  }
}

async function getTrainingStatus(modelId: string, opts?: { force?: boolean; maxAgeMs?: number }) {
  const force = !!opts?.force
  const maxAge = opts?.maxAgeMs ?? 5000
  const cached = state.trainingStatus[modelId]
  if (!force && cached && !isStale(cached.ts, maxAge)) return cached.data
  if (state.loadingTrainingStatus[modelId]) return cached?.data
  state.loadingTrainingStatus[modelId] = true
  try {
    const res = await modelsGetTrainingStatus({ id: modelId })
    const data = res?.data as TrainingStatus
    state.trainingStatus[modelId] = { data, ts: Date.now() }
    return data
  } finally {
    state.loadingTrainingStatus[modelId] = false
  }
}

export function useForgeStore() {
  return {
    state,
    // uploader
    addFiles,
    clearFiles,
    totalSizeMB,
    reset: resetForgeState,
    // lists
    loadUserModels,
    loadUserTrainingSets,
    // training status
    getTrainingStatus,
  }
}

export function resetForgeState() {
  Object.assign(state, createInitialState())
}
