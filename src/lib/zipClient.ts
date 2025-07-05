export function zipFiles(files: File[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./zipWorker.ts", import.meta.url), {
      type: "module",
    })

    worker.postMessage({ files })

    worker.onmessage = (e) => {
      if (e.data?.zipped) {
        resolve(e.data.zipped as Uint8Array)
      } else if (e.data?.error) {
        reject(new Error(e.data.error))
      } else {
        reject(new Error("Unknown response from zip worker"))
      }
      worker.terminate()
    }

    worker.onerror = (err) => {
      reject(err)
      worker.terminate()
    }
  })
}
