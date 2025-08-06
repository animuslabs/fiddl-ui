import type { AnyModel, ModelTags } from "lib/imageModels"
import { modelsGetBaseModels, modelsGetModelByName, modelsGetPublicModels, type ModelsGetBaseModels200Item, type ModelsGetCustomModel200, type ModelsGetModelByName200, type ModelsGetModelByNameParams, type ModelsGetPublicModels200Item } from "lib/orval"
import { LocalStorage } from "quasar"
import { arraysEqual } from "lib/util"
import { computed, reactive, ref, watch } from "vue"

// Extend the base model type to include an id: string field
type CustomModel = ModelsGetBaseModels200Item & { id: string; creatorId: string }

export const models = reactive({
  // base: LocalStorage.getItem<ModelsGetBaseModels200Item[]>("baseModels") || [],
  base: [] as ModelsGetBaseModels200Item[],
  custom: [] as CustomModel[],
  userModels: [] as CustomModel[], // Models filtered by specific user/creator
})

export const filteredBaseModels = computed<ModelsGetBaseModels200Item[]>(() => (filter.tag ? models.base.filter((el) => el.modelTags.includes(filter.tag as ModelTags)) : models.base))

export const allModels = computed(() =>
  [...filteredBaseModels.value, ...models.custom].sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  }),
)
export const featuredModels = computed(() => allModels.value.filter((model) => model.featured))
export const notFeaturedModels = computed(() => allModels.value.filter((model) => !model.featured))
export const userModels = computed(() => models.userModels)
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

export async function loadSingleModel(name: AnyModel, customModelId?: string) {
  const { data } = await modelsGetModelByName({ name, customModelId, includeMedia: 1 })

  if (customModelId) {
    const mappedData: CustomModel = {
      creatorId: data.customModelCreator!.id,
      ...data.model,
      previewMediaId: data.media![0]?.id,
      id: customModelId,
    }
    models.custom.push(mappedData)
  } else {
    const mappedData: ModelsGetBaseModels200Item = {
      ...data.model,
      previewMediaId: data.media![0]?.id,
    }
    models.base.push(mappedData)
  }
}

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
    tempObj[model.slug] = model
  }
  for (const model of newModels) {
    tempObj[model.slug] = model
  }

  const mergedSorted = (Object.values(tempObj) as ModelsGetPublicModels200Item[]).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const transformedModels: CustomModel[] = mergedSorted.map((model) => {
    return {
      ...model,
      blogLink: null,
      longDescription: null,
    }
  })
  models.custom = transformedModels
}

/**
 * Fetches custom models created by a specific user
 * @param creatorId - The ID of the user whose models to fetch
 * @param page - The page number to fetch from the API (default: 1)
 */
export async function loadUserModels(creatorId: string, page: number = 1) {
  loading.userModels = true
  try {
    const response = await modelsGetPublicModels({
      page,
      creatorId,
    })

    const newModels = response.data
    const transformedModels: CustomModel[] = newModels.map((model) => {
      return {
        blogLink: null,
        description: model.description,
        featured: model.featured,
        id: model.id,
        modelTags: model.modelTags,
        name: model.name,
        previewMediaId: model.previewMediaId,
        slug: model.slug,
        updatedAt: model.updatedAt,
        longDescription: null,
        creatorId: model.creatorId,
      }
    })

    // If it's page 1, replace the array; otherwise append
    if (page === 1) {
      models.userModels = transformedModels
    } else {
      // Merge and dedupe by id
      const existing = new Map(models.userModels.map((m) => [m.id, m]))
      transformedModels.forEach((model) => existing.set(model.id, model))
      models.userModels = Array.from(existing.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return response.data
  } finally {
    loading.userModels = false
  }
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
  userModels: false,
})
// void loadAllModels()
