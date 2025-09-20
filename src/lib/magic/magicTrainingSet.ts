import { trainingSetsCreateSet, trainingSetsFinalizeSet } from "lib/orval"
import { uploadWithProgress, uploadToPresignedPost } from "lib/api"
import { generateWebpThumbnails } from "lib/imageUtils"
import { zipFiles } from "lib/zipClient"

export type CreateMagicTrainingSetStage = "zip" | "create" | "uploadZip" | "thumbnails" | "finalize"

export interface CreateMagicTrainingSetOptions {
  name?: string
  description?: string
  onStage?: (stage: CreateMagicTrainingSetStage) => void
  onProgress?: (pct: number) => void
}

/**
 * Programmatic training set creation for Magic Mirror flow.
 * - Converts selfie blobs to File[]
 * - Zips and uploads via presigned POST
 * - Generates and uploads thumbnails
 * - Finalizes training set
 *
 * Returns the trainingSetId that can be used to start model training.
 */
export async function createMagicTrainingSet(blobs: Blob[], opts: CreateMagicTrainingSetOptions = {}): Promise<{ trainingSetId: string }> {
  if (!Array.isArray(blobs) || blobs.length === 0) throw new Error("No images provided")
  if (blobs.length > 100) throw new Error("Training sets can include at most 100 images.")
  // 1) Convert blobs to Files (zip worker expects File[])
  const files: File[] = blobs.map((b, i) => {
    const idx = String(i + 1).padStart(2, "0")
    return new File([b], `frame-${idx}.jpg`, { type: "image/jpeg" })
  })

  // 2) Zip
  opts.onStage?.("zip")
  const zipped = await zipFiles(files)
  const zipBuffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
  const zipBlob = new Blob([zipBuffer], { type: "application/zip" })

  // 3) Create training set to obtain presigned URLs
  opts.onStage?.("create")
  const setName = opts.name || `Magic Mirror: ` + new Date().toLocaleString()
  const setDesc = opts.description || ""
  const {
    data: newTrainingSet,
    status,
    statusText,
  } = await trainingSetsCreateSet({
    name: setName,
    description: setDesc,
    numImages: files.length,
    zipSizeMb: Math.ceil(zipBlob.size / 1_000_000),
  })
  if (status > 201) throw new Error("Failed to create training set: " + statusText)

  // 4) Upload zip with progress
  opts.onStage?.("uploadZip")
  await uploadWithProgress({
    file: zipBlob,
    presignedPost: newTrainingSet.signedZipUploadData,
    onProgress: (p) => opts.onProgress?.(p),
  })

  // 5) Generate and upload thumbnails
  opts.onStage?.("thumbnails")
  const thumbs = await generateWebpThumbnails(files, 512, 0.8)
  const uploadSlots = newTrainingSet.signedThumbnailUploadDatas || []
  const total = Math.min(thumbs.length, uploadSlots.length)
  for (let i = 0; i < total; i++) {
    const presignedPost = uploadSlots[i]
    const file = thumbs[i]
    if (!presignedPost || !file) continue
    await uploadToPresignedPost({ file, presignedPost })
    const pct = Math.round(((i + 1) / total) * 100)
    opts.onProgress?.(pct)
  }

  // 6) Finalize
  opts.onStage?.("finalize")
  await trainingSetsFinalizeSet({ trainingSetId: newTrainingSet.trainingSetId })

  return { trainingSetId: newTrainingSet.trainingSetId }
}
