import { reactive, computed } from "vue"

export function useLoadingStates<T extends string>(initialKeys: T[], initialValues: Partial<Record<T, boolean>> = {}) {
  const loading = reactive(Object.fromEntries(initialKeys.map((key) => [key, initialValues[key] ?? false])) as Record<T, boolean>)

  const anyLoading = computed(() => Object.values(loading).some(Boolean))

  return { loading, anyLoading }
}
