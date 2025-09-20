import { sleep } from "lib/util"

async function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = (err) => reject(err)
    img.src = URL.createObjectURL(file)
  })
}

async function loadImageSource(file: File): Promise<{ source: ImageBitmap | HTMLImageElement; release(): void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any)
    return {
      source: bitmap,
      release() {
        bitmap.close()
      },
    }
  } catch {
    const img = await decodeImage(file)
    return {
      source: img,
      release() {
        /* no-op */
      },
    }
  }
}

function getImageDimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (source instanceof ImageBitmap) return { width: source.width, height: source.height }
  const el = source as HTMLImageElement
  const width = el.naturalWidth || el.width
  const height = el.naturalHeight || el.height
  return { width, height }
}

async function toJpegBlob(file: File, maxSize: number, quality: number, allowUpscale: boolean): Promise<Blob> {
  const { source, release } = await loadImageSource(file)
  try {
    const { width, height } = getImageDimensions(source)
    if (!width || !height) throw new Error("Image has invalid dimensions")

    const longestSide = Math.max(width, height)
    const rawScale = maxSize / longestSide
    let scale = rawScale
    if (!Number.isFinite(scale) || scale <= 0) scale = 1
    if (!allowUpscale && scale > 1) scale = 1

    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context not available")

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to convert to blob"))), "image/jpeg", quality),
    )
    if (!blob || blob.size === 0) throw new Error(`Generated blob is empty for ${file.name}`)
    return blob
  } finally {
    release()
  }
}

function ensureJpegFileName(originalName: string, usedNames?: Set<string>): string {
  const base = originalName.replace(/\.[^.]+$/i, "") || "image"
  let candidate = `${base}.jpg`
  if (!usedNames) return candidate
  let counter = 1
  while (usedNames.has(candidate)) {
    candidate = `${base}-${counter}.jpg`
    counter += 1
  }
  return candidate
}

export async function convertImageFileToJpeg(
  file: File,
  maxSize = 1024,
  quality = 0.95,
  opts?: { usedNames?: Set<string>; allowUpscale?: boolean },
): Promise<File> {
  const usedNames = opts?.usedNames
  const blob = await toJpegBlob(file, maxSize, quality, opts?.allowUpscale ?? false)
  const name = ensureJpegFileName(file.name, usedNames)
  if (usedNames) usedNames.add(name)
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified })
}

export async function convertFilesToJpeg(
  files: File[],
  maxSize = 1024,
  quality = 0.95,
  opts?: { usedNames?: Set<string>; allowUpscale?: boolean },
): Promise<File[]> {
  const converted: File[] = []
  const usedNames = opts?.usedNames ?? new Set<string>()
  for (const file of files) {
    const convertedFile = await convertImageFileToJpeg(file, maxSize, quality, { usedNames, allowUpscale: opts?.allowUpscale })
    converted.push(convertedFile)
    await sleep(1)
  }
  return converted
}

export async function generateWebpThumbnails(
  files: File[],
  maxSize = 128,
  quality = 0.6,
  opts?: { allowUpscale?: boolean },
): Promise<Blob[]> {
  const thumbnails: Blob[] = []
  let targetImgName: null | string = null
  const allowUpscale = opts?.allowUpscale ?? true

  try {
    for (const file of files) {
      console.log("Processing file:", file.name)
      targetImgName = file.name

      const blob = await toWebpBlob(file, maxSize, quality, allowUpscale)
      thumbnails.push(blob)
      await sleep(1)
    }
  } catch (error) {
    console.error("Error generating thumbnails:", error)
    throw new Error(`Failed to generate thumbnails for ${targetImgName || "unknown file"}. Please ensure the file is a valid image.`)
  }

  return thumbnails
}
