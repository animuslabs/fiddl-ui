// Frontend helpers for Prompt Templates: gender resolution and prompt building

export type Slot =
  | "subject"
  | "setting"
  | "style"
  | "lighting"
  | "camera"
  | "mood"
  | "composition"
  | "color"
  | "postprocess"
  | "negative"

export type TemplateKind = "subject" | "setting" | "style" | "effect"

export type Gender = "male" | "female"

export interface PromptTemplate {
  id: string
  name: string
  kind: TemplateKind
  slots: Partial<Record<Slot, string | string[]>>
  tags: string[]
  previewUrl: string
}

// Server-provided template that may contain gendered subject and gendered previews
export interface GenderedPromptTemplate extends Omit<PromptTemplate, "previewUrl" | "slots"> {
  previewUrlMale: string | null
  previewUrlFemale: string | null
  // subject can be gender-neutral OR overridden per gender
  slots: Partial<Record<Slot, string | string[]>> & {
    subject?: string | string[]
    maleSubject?: string | string[]
    femaleSubject?: string | string[]
  }
}

export interface ResolvedPrompt {
  prompt: string
  negativePrompt?: string
  usedTemplateIds: string[]
  slots: Partial<Record<Exclude<Slot, "negative">, string[]>>
}

// Map an API item into our GenderedPromptTemplate shape
// Accepts the minimal shape we rely on to avoid tight coupling to generated types
export function asGenderedTemplateFromApi(item: {
  id: string
  name: string
  kind: string
  tags?: string[]
  previewUrl?: string | null
  previewUrlMale?: string | null
  previewUrlFemale?: string | null
  slots?: Record<string, string | string[]>
}): GenderedPromptTemplate {
  const { id, name, kind, tags, previewUrl, previewUrlMale, previewUrlFemale } = item
  const rawSlots = item.slots || {}

  // Normalize known slot keys while preserving any additional slots
  const normSlots: GenderedPromptTemplate["slots"] = {
    ...rawSlots,
    subject: rawSlots.subject,
    maleSubject: rawSlots.maleSubject,
    femaleSubject: rawSlots.femaleSubject,
  }

  return {
    id,
    name,
    kind: (kind as TemplateKind) || "subject",
    tags: (tags || []).slice(),
    // Keep gendered previews; generic previewUrl is used as fallback later
    previewUrlMale: previewUrlMale ?? null,
    previewUrlFemale: previewUrlFemale ?? null,
    slots: normSlots,
  }
}

export function resolveGenderedTemplate(t: GenderedPromptTemplate, gender: Gender): PromptTemplate {
  const subject =
    (gender === "male" ? t.slots.maleSubject : t.slots.femaleSubject) ?? t.slots.subject

  const { maleSubject, femaleSubject, ...restSlots } = t.slots
  const previewUrl =
    (gender === "male" ? t.previewUrlMale : t.previewUrlFemale) ||
    (gender === "male" ? t.previewUrlFemale : t.previewUrlMale) ||
    "" // frontend can show placeholder if empty

  return {
    id: `${t.id}-${gender}`,
    name: `${t.name} (${gender})`,
    kind: t.kind,
    previewUrl,
    tags: [...(t.tags || []), "face", gender],
    slots: {
      ...restSlots,
      ...(subject ? { subject } : {}),
    },
  }
}

export function resolveGenderedTemplates(list: GenderedPromptTemplate[], gender: Gender): PromptTemplate[] {
  return list.map((t) => resolveGenderedTemplate(t, gender))
}

const DEFAULT_SLOT_ORDER: Exclude<Slot, "negative">[] = [
  "subject",
  "setting",
  "style",
  "lighting",
  "camera",
  "mood",
  "composition",
  "color",
  "postprocess",
]

export function promptFromTemplates(
  templates: PromptTemplate[],
  opts?: { slotOrder?: Exclude<Slot, "negative">[]; joiner?: string },
): ResolvedPrompt {
  const order = opts?.slotOrder ?? DEFAULT_SLOT_ORDER
  const joiner = opts?.joiner ?? ", "

  const slots: Partial<Record<Exclude<Slot, "negative">, string[]>> = {}
  const negatives: string[] = []

  for (const t of templates) {
    for (const [rawSlot, val] of Object.entries(t.slots) as [Slot, string | string[]][]) {
      if (!val) continue
      if (rawSlot === "negative") {
        negatives.push(...toArr(val))
      } else {
        const s = rawSlot as Exclude<Slot, "negative">
        if (!slots[s]) slots[s] = []
        slots[s]!.push(...toArr(val))
      }
    }
  }

  for (const k of Object.keys(slots) as (keyof typeof slots)[]) {
    slots[k] = dedupe(slots[k]!)
  }
  const negativePrompt = dedupe(negatives).join(joiner) || undefined

  const parts: string[] = []
  for (const s of order) {
    const vals = slots[s]
    if (vals && vals.length) parts.push(vals.join(joiner))
  }

  return {
    prompt: parts.join(joiner),
    negativePrompt,
    usedTemplateIds: templates.map((t) => t.id),
    slots,
  }
}

// Utils
const toArr = (v: string | string[]) => (Array.isArray(v) ? v : [v])
const clean = (s: string) => s.trim()
const dedupe = (arr: string[]) => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr.map(clean).filter(Boolean)) {
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}