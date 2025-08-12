/**
 * Placeholder API for scheduling server-side renders once a model finishes training.
 * The real endpoint does not exist yet; replace this with an orval client call later.
 *
 * Usage:
 *   await scheduleMagicRenders({
 *     customModelId: 'xxx',
 *     templates: ['knight', 'astronaut', 'samurai']
 *   })
 */
export async function scheduleMagicRenders(params: { customModelId: string; templates: string[] }): Promise<void> {
  // TODO: Replace with real API (e.g. POST /magic/scheduleRenders)
  console.log("[magicApi] scheduleMagicRenders placeholder:", params)
  await new Promise((r) => setTimeout(r, 200))
}
