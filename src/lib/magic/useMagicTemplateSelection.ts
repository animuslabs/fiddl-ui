import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Gender, PromptTemplate, GenderedPromptTemplate } from 'src/lib/promptTemplates'
import { resolveGenderedTemplates } from 'src/lib/promptTemplates'

export type DialogMode = 'initial' | 'additional'

export function useMagicTemplateSelection(opts: {
  genderForTemplates: Ref<Gender | null> | ComputedRef<Gender | null>
  rawTemplates: ComputedRef<GenderedPromptTemplate[]>
}) {
  const dialogOpen = ref(false)
  const dialogSelection = ref<string[]>([])
  const dialogMode = ref<DialogMode>('initial')
  const selectedTemplates = ref<string[]>([])
  const templatesConfirmed = ref(false)

  const displayTemplates = computed<PromptTemplate[]>(() => {
    const g = opts.genderForTemplates.value
    return g ? resolveGenderedTemplates(opts.rawTemplates.value, g) : []
  })

  const templatesById = computed(() => new Map(displayTemplates.value.map((t) => [t.id, t] as [string, PromptTemplate])))

  function getTemplateByAnyId(id: string): PromptTemplate | undefined {
    const direct = templatesById.value.get(id)
    if (direct) return direct
    const g = opts.genderForTemplates.value
    if (g && !id.endsWith(`-${g}`)) {
      const suffixed = `${id}-${g}`
      return templatesById.value.get(suffixed)
    }
    return undefined
  }

  const selectedTemplateObjs = computed<PromptTemplate[]>(() => selectedTemplates.value.map((id) => getTemplateByAnyId(id)).filter(Boolean) as PromptTemplate[])

  function openTemplatesDialog(mode: DialogMode) {
    dialogMode.value = mode
    dialogSelection.value = mode === 'initial' ? selectedTemplates.value.slice() : []
    dialogOpen.value = true
  }

  return {
    // dialog state
    dialogOpen,
    dialogSelection,
    dialogMode,
    selectedTemplates,
    templatesConfirmed,
    // template helpers
    displayTemplates,
    templatesById,
    getTemplateByAnyId,
    selectedTemplateObjs,
    // actions
    openTemplatesDialog,
  }
}

