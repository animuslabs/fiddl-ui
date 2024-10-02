const MAX_CACHE_SIZE = 5 * 1024 * 1024 // 5 MB limit
const CACHE_KEY_PREFIX = "image_cache_"
const CACHE_INDEX_KEY = "image_cache_index"

type CacheIndex = string[] // Array of image names

/**
 * Get the current cache size.
 * @returns The total size of cached items in bytes.
 */
function getCacheSize(): number {
  let totalSize = 0
  for (const key in localStorage) {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      const item = localStorage.getItem(key)
      totalSize += item ? item.length : 0
    }
  }
  return totalSize
}

/**
 * Update the LRU index to mark an item as recently used.
 * @param imageName - The name of the image to update in the LRU cache.
 */
function updateCacheIndex(imageName: string): void {
  const cacheIndex: CacheIndex = JSON.parse(localStorage.getItem(CACHE_INDEX_KEY) || "[]")

  // Remove the imageName if it already exists
  const existingIndex = cacheIndex.indexOf(imageName)
  if (existingIndex > -1) {
    cacheIndex.splice(existingIndex, 1)
  }

  // Add the imageName to the front
  cacheIndex.unshift(imageName)
  localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(cacheIndex))
}

/**
 * Remove the least recently used item from the cache.
 */
function removeLRUItem(): void {
  const cacheIndex: CacheIndex = JSON.parse(localStorage.getItem(CACHE_INDEX_KEY) || "[]")
  const lruImageName = cacheIndex.pop() // Remove the last item (least recently used)

  if (lruImageName) {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${lruImageName}`)
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(cacheIndex))
  }
}

/**
 * Store an image in the cache, removing the LRU items if the storage limit is exceeded.
 * @param imageName - The name of the image to store.
 * @param imageData - The base64 string of the image data.
 */
export function storeImageInCache(imageName: string, imageData: string): void {
  // Remove items if exceeding the storage limit
  while (getCacheSize() + imageData.length > MAX_CACHE_SIZE) {
    removeLRUItem()
  }

  // Store the new image
  localStorage.setItem(`${CACHE_KEY_PREFIX}${imageName}`, imageData)
  updateCacheIndex(imageName)
}

/**
 * Retrieve an image from the cache.
 * @param imageName - The name of the image to retrieve.
 * @returns The base64 string of the image data or undefined if not found.
 */
export function getImageFromCache(imageName: string): string | undefined {
  const imageData = localStorage.getItem(`${CACHE_KEY_PREFIX}${imageName}`)
  if (imageData) {
    updateCacheIndex(imageName) // Update the LRU index on access
  }
  return imageData || undefined
}
