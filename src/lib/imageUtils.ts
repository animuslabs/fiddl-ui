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

export async function generateWebpThumbnails(files: File[], maxSize = 128, quality = 0.6): Promise<Blob[]> {
  const thumbnails: Blob[] = []
  let targetImgName: null | string = null

  try {
    for (const file of files) {
      console.log("Processing file:", file.name)
      targetImgName = file.name

      let imageBitmap: ImageBitmap | HTMLImageElement

      try {
        imageBitmap = await createImageBitmap(file)
      } catch {
        console.warn("createImageBitmap failed, falling back to <img> for:", file.name)
        imageBitmap = await decodeImage(file)
      }

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
      if (blob.size === 0) throw new Error(`Generated thumbnail blob is 0 bytes for ${file.name}`)

      thumbnails.push(blob)
      await sleep(1)
    }
  } catch (error) {
    console.error("Error generating thumbnails:", error)
    throw new Error(`Failed to generate thumbnails for ${targetImgName || "unknown file"}. Please ensure the file is a valid image.`)
  }

  return thumbnails
}
