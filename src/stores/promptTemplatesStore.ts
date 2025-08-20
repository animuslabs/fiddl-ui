import { defineStore } from "pinia"
import { promptTemplatesList, PromptTemplatesListKind } from "lib/orval"
import { asGenderedTemplateFromApi, type GenderedPromptTemplate, type TemplateKind } from "src/lib/promptTemplates"

type KindKey = TemplateKind

export const usePromptTemplatesStore = defineStore("promptTemplatesStore", {
  state: () => ({
    templates: [] as GenderedPromptTemplate[],
    loading: false,
    loaded: false,
    error: null as string | null,
    // Cache per kind for Create page usage (pre-initialize keys to ensure reactivity)
    byKind: {
      subject: { items: [] as GenderedPromptTemplate[], loaded: false, loading: false, error: null },
      setting: { items: [] as GenderedPromptTemplate[], loaded: false, loading: false, error: null },
      style:   { items: [] as GenderedPromptTemplate[], loaded: false, loading: false, error: null },
      mood:    { items: [] as GenderedPromptTemplate[], loaded: false, loading: false, error: null },
    } as Record<KindKey, { items: GenderedPromptTemplate[]; loaded: boolean; loading: boolean; error: string | null }>,
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

    // Generic loader by kind without tag constraints (for Create page)
    async loadByKind(kind: KindKey, force = false) {
      const slot = this.byKind[kind] || { items: [], loaded: false, loading: false, error: null }
      if (!force && (slot.loaded || slot.loading)) {
        this.byKind[kind] = { ...slot }
        return
      }
      slot.loading = true
      slot.error = null
      this.byKind[kind] = { ...slot }
      try {
        const { data } = await promptTemplatesList({
          kind: PromptTemplatesListKind[kind],
          pageSize: 100,
        } as any)
        const items = Array.isArray(data) ? data : []
        slot.items = items.map((it) => asGenderedTemplateFromApi(it as any))
        slot.loaded = true
      } catch (e: any) {
        slot.error = e?.message || "Failed to load templates"
        slot.items = []
      } finally {
        slot.loading = false
        this.byKind[kind] = slot
      }
    },
  },
})