let supportsDynamicViewportUnitsCache: boolean | null = null

function detectDynamicViewportSupport(): boolean {
  if (supportsDynamicViewportUnitsCache !== null) return supportsDynamicViewportUnitsCache

  supportsDynamicViewportUnitsCache =
    typeof window !== "undefined" &&
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("height: 100dvh")

  return supportsDynamicViewportUnitsCache
}

export function hasDynamicViewportUnits(): boolean {
  return detectDynamicViewportSupport()
}

export function viewportHeight(value: number | string = 100): string {
  const useDynamic = detectDynamicViewportSupport()
  if (typeof value === "number") {
    return `${value}${useDynamic ? "dvh" : "vh"}`
  }

  return useDynamic ? value.replace(/vh/g, "dvh") : value
}
