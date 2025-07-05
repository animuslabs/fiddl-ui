/// <reference lib="webworker" />
import { zipSync } from "fflate"
interface ZipWorkerMessage {
  files: File[]
}

const ctx = self as DedicatedWorkerGlobalScope

ctx.onmessage = async (e: MessageEvent<ZipWorkerMessage>) => {
  try {
    const { files } = e.data
    const fileMap: Record<string, Uint8Array> = {}

    for (const file of files) {
      const buffer = await file.arrayBuffer()
      fileMap[file.name] = new Uint8Array(buffer)
    }

    const zipped = zipSync(fileMap)
    ctx.postMessage({ zipped }, [zipped.buffer])
  } catch (err: any) {
    ctx.postMessage({ error: err?.message || "Unknown error in zip worker" })
  }
}
