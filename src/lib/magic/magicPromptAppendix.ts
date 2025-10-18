// Shared Magic Mirror prompt addition to gently refine facial aesthetics
// Keep generic to work across stylized templates; avoid photorealistic cues
export function appendMagicMirrorAesthetic(prompt: string): string {
  const appendix = "subtle face retouching, remove minor blemishes, flattering facial lighting, natural flattering result that preserves the template's style"
  // Append with a separating comma if prompt looks like a list; otherwise a space
  const sep = /[.,;:]\s*$/.test(prompt) ? " " : ", "
  return `${prompt}${sep}${appendix}`
}
