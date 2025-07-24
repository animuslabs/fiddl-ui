import type { ModelTags } from "lib/imageModels"
import { modelsGetBaseModels, modelsGetPublicModels, type ModelsGetBaseModels200Item, type ModelsGetCustomModel200, type ModelsGetPublicModels200Item } from "lib/orval"
import { LocalStorage } from "quasar"
import { arraysEqual } from "lib/util"
import { computed, reactive, ref, watch } from "vue"

export const models = reactive({
  base: (LocalStorage.getItem("baseModels") as ModelsGetBaseModels200Item[]) || [],
  custom: [] as ModelsGetPublicModels200Item[],
})

export const filteredBaseModels = computed(() => (filter.tag ? models.base.filter((el) => el.modelTags.includes(filter.tag as ModelTags)) : models.base))

export const allModels = computed(() => [...models.base, ...models.custom].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
export const filter = reactive({
  tag: null as ModelTags | null,
  currentPage: 1,
})

/**
 * Watcher for filter changes:
 * - If tags change, clear models.custom and reload with new tags.
 * - If currentPage increases, load the next page.
 * - If neither changes, do nothing.
 */
watch(
  () => filter.tag,
  (newTag, oldTag) => {
    if (newTag !== oldTag) {
      models.custom = []
      filter.currentPage = 1
      void loadCustomModels()
    }
  },
)

watch(
  () => filter.currentPage,
  (newPage, oldPage) => {
    if (newPage > oldPage) {
      void loadCustomModels()
    }
  },
)

export async function loadAllModels() {
  loading.base = true
  loading.custom = true
  const [base, custom] = await Promise.allSettled([modelsGetBaseModels(), loadCustomModels()])
  loading.base = false
  loading.custom = false
  if (base.status == "fulfilled") {
    models.base = base.value.data
    LocalStorage.set("baseModels", base.value.data)
  }
}

/**
 * Fetches public custom models, merges them with the existing models.custom array,
 * removes duplicates by id, sorts by updatedAt (descending), and updates the array
 * in a single operation for optimal reactivity.
 * @param page - The page number to fetch from the API (default: 1)
 */
export async function loadCustomModels() {
  loading.custom = true
  const response = await modelsGetPublicModels({ page: filter.currentPage, tag: filter.tag ? filter.tag : undefined }).finally(() => (loading.custom = false))

  const newModels = response.data
  const tempObj = {}
  for (const model of models.custom) {
    tempObj[model.id] = model
  }
  for (const model of newModels) {
    tempObj[model.id] = model
  }
  const mergedSorted = (Object.values(tempObj) as ModelsGetPublicModels200Item[]).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  models.custom = mergedSorted
}

// export function addTag(tag: ModelTags | ModelTags[]) {
//   const tags = Array.isArray(tag) ? tag : [tag]
//   for (const t of tags) {
//     if (!filter.tags.includes(t)) filter.tags.push(t)
//   }
// }

// export function removeTag(tag: ModelTags | ModelTags[]) {
//   const tagsToRemove = new Set(Array.isArray(tag) ? tag : [tag])
//   filter.tags = filter.tags.filter((t) => !tagsToRemove.has(t))
// }

// export function toggleTag(tag: ModelTags | ModelTags[]) {
//   const tags = Array.isArray(tag) ? tag : [tag]
//   for (const t of tags) {
//     const val = filter.tags.includes(t) ? removeTag(t) : addTag(t)
//   }
// }
export const loading = reactive({
  base: false,
  custom: false,
})
void loadAllModels()
