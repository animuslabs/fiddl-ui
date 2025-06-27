import { sleep } from "lib/util"

export async function generateWebpThumbnails(files: File[], maxSize = 128, quality = 0.6): Promise<Blob[]> {
  const thumbnails: Blob[] = []

  for (const file of files) {
    const imageBitmap = await createImageBitmap(file)

    const { width, height } = imageBitmap
    const aspectRatio = width / height

    let targetWidth = maxSize
    let targetHeight = maxSize

    if (aspectRatio > 1) {
      targetHeight = maxSize / aspectRatio
    } else {
      targetWidth = maxSize * aspectRatio
    }

    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context not available")

    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to convert to blob"))), "image/webp", quality))

    thumbnails.push(blob)
    await sleep(1) // Small delay to avoid blocking the main thread
  }

  return thumbnails
}
