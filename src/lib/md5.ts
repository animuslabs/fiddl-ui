import SparkMD5 from "spark-md5"

export async function md5File(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2 * 1024 * 1024 // 2 MB
    const chunks = Math.ceil(file.size / chunkSize)
    let current = 0
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()

    reader.onload = (e) => {
      spark.append(e.target!.result as ArrayBuffer)
      current += 1
      if (current < chunks) {
        loadNext()
      } else {
        resolve(spark.end())
      }
    }
    reader.onerror = () => reject(reader.error)

    const loadNext = () => {
      const start = current * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    loadNext()
  })
}
