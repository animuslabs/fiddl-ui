export interface FluxKontextRequest {
  itemId: string
  prompt: string
  edits: {
    filter: string | null
    brightness: number
    contrast: number
  }
}

export interface FluxKontextJob {
  jobId: string
  etaMs?: number
}

/**
 * Temporary stub for the Flux Kontext image edit API.
 * Returns a fake job id and short ETA so the UI can show progress.
 */
export async function requestFluxKontextEdit(request: FluxKontextRequest): Promise<FluxKontextJob> {
  console.info("FluxKontext stub request", request)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ jobId: `flux-${Math.random().toString(36).slice(2, 10)}`, etaMs: 1400 })
    }, 250)
  })
}
