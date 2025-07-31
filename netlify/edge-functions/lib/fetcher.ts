export const fetcher = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options)

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}
