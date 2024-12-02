import { openDB, IDBPDatabase } from "idb"

const CACHE_DB_NAME = "ImageCacheDB"
const CACHE_STORE_NAME = "ImageStore"
const MAX_CACHE_SIZE = 30 * 1024 * 1024

/**
 * Open or initialize the IndexedDB.
 */
function getDB(): Promise<IDBPDatabase> {
  return openDB(CACHE_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: "imageName" })
      }
    },
  })
}

/**
 * Get the current cache size.
 * @returns The total size of cached items in bytes.
 */
async function getCacheSize(db: IDBPDatabase): Promise<number> {
  const tx = db.transaction(CACHE_STORE_NAME, "readonly")
  const store = tx.objectStore(CACHE_STORE_NAME)
  let totalSize = 0

  let cursor = await store.openCursor()
  while (cursor) {
    totalSize += cursor.value.imageData.length
    cursor = await cursor.continue()
  }

  return totalSize
}

/**
 * Update the LRU index to mark an item as recently used.
 * @param imageName - The name of the image to update in the LRU cache.
 */
async function updateCacheIndex(db: IDBPDatabase, imageName: string): Promise<void> {
  const tx = db.transaction(CACHE_STORE_NAME, "readwrite")
  const store = tx.objectStore(CACHE_STORE_NAME)

  const item = await store.get(imageName)
  if (item) {
    await store.put({ ...item, timestamp: Date.now() })
  }
}

/**
 * Remove the least recently used item from the cache.
 */
async function removeLRUItem(db: IDBPDatabase): Promise<void> {
  const tx = db.transaction(CACHE_STORE_NAME, "readwrite")
  const store = tx.objectStore(CACHE_STORE_NAME)

  let oldestKey: string | null = null
  let oldestTimestamp = Infinity

  let cursor = await store.openCursor()
  while (cursor) {
    const { imageName, timestamp } = cursor.value
    if (timestamp < oldestTimestamp) {
      oldestTimestamp = timestamp
      oldestKey = imageName
    }
    cursor = await cursor.continue()
  }

  if (oldestKey) {
    await store.delete(oldestKey)
  }
}

/**
 * Store an image in the cache, removing LRU items if storage limit is exceeded.
 * @param imageName - The name of the image to store.
 * @param imageData - The base64 string of the image data.
 */
export async function storeImageInCache(imageName: string, imageData: string): Promise<void> {
  const db = await getDB()
  const cacheSize = await getCacheSize(db)

  while (cacheSize + imageData.length > MAX_CACHE_SIZE) {
    await removeLRUItem(db)
  }

  await db.put(CACHE_STORE_NAME, {
    imageName,
    imageData,
    timestamp: Date.now(),
  })
}

/**
 * Retrieve an image from the cache.
 * @param imageName - The name of the image to retrieve.
 * @returns The base64 string of the image data or undefined if not found.
 */
export async function getImageFromCache(imageName: string): Promise<string | undefined> {
  const db = await getDB()
  const result = await db.get(CACHE_STORE_NAME, imageName)

  if (result) {
    // Update LRU timestamp
    await updateCacheIndex(db, imageName)
    return result.imageData
  }

  return undefined
}

/**
 * Clear all images from the cache.
 */
export async function clearImageCache(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(CACHE_STORE_NAME, "readwrite")
  await tx.objectStore(CACHE_STORE_NAME).clear()
  await tx.done
}
