import { makeZip } from "client-zip"

// placeholder code to handle zipping files and uploading them

type ZipEntry = {
  name: string
  input: File | Blob
  lastModified?: Date
}

export function createZipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  return makeZip(
    entries.map((e) => ({
      name: e.name,
      lastModified: e.lastModified ?? new Date(),
      input: e.input,
    })),
  )
}
// const stream = createZipStream(files)
// const response = await fetch(presignedUrl, {
//   method: "PUT",
//   headers: { "Content-Type": "application/zip" },
//   body: stream,
// })
// if (!response.ok) throw new Error("Upload failed")
