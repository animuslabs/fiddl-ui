//@ts-ignore
const env = Netlify.env.toObject()
console.log(env.API_ROOT)
const API_ROOT = env.VITE_API_ROOT
console.log(`API_ROOT: ${API_ROOT}`)
export const fetcher = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const absolute = url.startsWith("http") ? url : `${API_ROOT}${url}`
  console.log(`Fetching: ${absolute}`, options)
  const res = await fetch(absolute, options)
  if (!res.ok) throw new Error(`Error: HTTP ${res.status}, ${res.statusText} for ${absolute} ${JSON.stringify(options)}`)
  return (await res.json()) as T
}
