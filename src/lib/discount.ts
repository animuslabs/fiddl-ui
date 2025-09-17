import * as api from "./orval"

export type DiscountValidationStatus =
  | { ok: true; code: string; discountPct: number; used?: number; maximumUses?: number | null; linkedUserId?: string | null }
  | { ok: false; reason: "not_found" | "exhausted" }

export function normalizeCode(input: string | null | undefined): string | null {
  const c = (input || "").trim()
  if (!c) return null
  return c.toUpperCase()
}

export function roundUsd(usd: number): number {
  return Math.round(usd * 100) / 100
}

export function usdToString(usd: number): string {
  return roundUsd(usd).toFixed(2)
}

export function applyDiscountUsd(usd: number, discountPct: number): number {
  if (!discountPct) return roundUsd(usd)
  const final = usd * (1 - discountPct)
  return roundUsd(final)
}

export type PriceBreakdown = { baseUsd: number; codeDiscountPct: number; finalUsd: number }
export function calculateFinalUsd(baseUsd: number, codeDiscountPct: number = 0): PriceBreakdown {
  const finalUsd = applyDiscountUsd(baseUsd, codeDiscountPct || 0)
  return { baseUsd, codeDiscountPct: codeDiscountPct || 0, finalUsd }
}

/**
 * Call backend to validate a discount code. Uses orval endpoint if present; falls back to REST path.
 */
export async function validateDiscountCode(codeInput: string, packageId: number): Promise<{ status: DiscountValidationStatus; pricing: PriceBreakdown }>
{
  const code = normalizeCode(codeInput)
  if (!code) return { status: { ok: false, reason: "not_found" }, pricing: calculateFinalUsd(0, 0) }

  const res = await api.discountsValidate({ code, packageId })
  const data = res?.data
  if (!data) return { status: { ok: false, reason: "not_found" }, pricing: calculateFinalUsd(0, 0) }
  if (!data.ok) {
    // Invalid reasons: not_found or exhausted
    return { status: { ok: false, reason: (data.reason as any) || "not_found" }, pricing: { baseUsd: data.pricing?.baseUsd ?? 0, codeDiscountPct: 0, finalUsd: data.pricing?.baseUsd ?? 0 } }
  }

  // Map to frontend-friendly shape; expire/usage data not included in API
  const status: DiscountValidationStatus = { ok: true, code: data.code || code, discountPct: Number(data.discountPct) || 0 }
  const pricing: PriceBreakdown = { baseUsd: Number(data.pricing.baseUsd), codeDiscountPct: Number(data.pricing.codeDiscountPct || 0), finalUsd: Number(data.pricing.finalUsd) }
  return { status, pricing }
}

export async function validateAndPrice(baseUsd: number, discountCode: string | null | undefined, packageId: number) {
  const normalized = normalizeCode(discountCode)
  if (!normalized) return { status: { ok: true as const, code: null as any, discountPct: 0 }, pricing: calculateFinalUsd(baseUsd, 0) }
  return validateDiscountCode(normalized, packageId)
}
