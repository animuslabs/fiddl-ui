import { defineStore } from "pinia"
import { promptTemplatesList, PromptTemplatesListKind } from "lib/orval"
import { asGenderedTemplateFromApi, type GenderedPromptTemplate } from "src/lib/promptTemplates"

export const usePromptTemplatesStore = defineStore("promptTemplatesStore", {
  state: () => ({
    templates: [] as GenderedPromptTemplate[],
    loading: false,
    loaded: false,
    error: null as string | null,
  }),
  actions: {
    async loadSubjectFaceTemplates() {
      if (this.loaded || this.loading) return
      this.loading = true
      this.error = null
      try {
        const { data } = await promptTemplatesList({
          kind: PromptTemplatesListKind.subject,
          tag: "face",
          pageSize: 100,
        })
        const items = Array.isArray(data) ? data : []
        this.templates = items.map((it) => asGenderedTemplateFromApi(it as any))
        this.loaded = true
      } catch (e: any) {
        this.error = e?.message || "Failed to load prompt templates"
        this.templates = []
      } finally {
        this.loading = false
      }
    },
  },
})