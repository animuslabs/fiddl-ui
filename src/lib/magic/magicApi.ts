/**
 * Magic Mirror batch scheduling helpers
 *
 * We take the selected gender-resolved PromptTemplate items, resolve them into
 * concrete prompts/negatives, convert them into Create API batch requests, and
 * submit the whole batch using the server's queueAsyncBatch endpoint.
 */
import { createQueueAsyncBatch, type CreateImageBodyAspectRatio } from "lib/orval"
import { promptFromTemplates, type PromptTemplate } from "src/lib/promptTemplates"
import { appendMagicMirrorAesthetic } from "src/lib/magic/magicPromptAppendix"

export type MagicScheduleParams = {
  customModelId: string
  templates: PromptTemplate[]
  quantity?: number
  public?: boolean
  aspectRatio?: CreateImageBodyAspectRatio
  emailNotify?: boolean
  subjectDescription?: string
}

/**
 * Build image-create batch requests from a list of prompt templates.
 * Each template becomes one request item (quantity default = 1).
 */
export function buildImageRequestsFromTemplates(params: { customModelId: string; templates: PromptTemplate[]; quantity?: number; public?: boolean; aspectRatio?: MagicScheduleParams["aspectRatio"] }) {
  const { customModelId, templates, quantity = 1, public: isPublic = false, aspectRatio = "9:16" } = params

  // Map the templates into concrete requests the batch API expects
  // Shape matches CreateQueueAsyncBatchBodyRequestsItemAnyOf (image variant)
  const requests = templates.filter(Boolean).map((tpl) => {
    const resolved = promptFromTemplates([tpl])
    return {
      prompt: resolved.prompt,
      negativePrompt: resolved.negativePrompt,
      quantity,
      model: "custom" as const,
      public: isPublic,
      aspectRatio: aspectRatio as any,
      customModelId,
    }
  })

  return requests
}

/**
 * Schedule the entire set of selected templates as a single batch on the server.
 * - Resolves template slots into final prompt/negative.
 * - Builds image request objects with the provided custom model id.
 * - Sends to queueAsyncBatch so the server can produce all images as a batch.
 */
export async function scheduleMagicRenders({ customModelId, templates, subjectDescription, quantity = 1, public: isPublic = false, aspectRatio = "9:16", emailNotify = false }: MagicScheduleParams): Promise<string | null> {
  const requests = buildImageRequestsFromTemplates({
    customModelId,
    templates,
    quantity,
    public: isPublic,
    aspectRatio,
  })
  if (!requests.length) return null
  const res = await createQueueAsyncBatch({
    requests: requests.map((el) => {
      const withSubject = subjectDescription && subjectDescription.trim().length
        ? `${el.prompt} Subject Base Details: ${subjectDescription}`
        : el.prompt
      el.prompt = appendMagicMirrorAesthetic(withSubject)
      return el
    }),
    emailNotify,
  })
  return res.data?.batchId || null
}
