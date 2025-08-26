import { LocalStorage } from "quasar"
import type { MediaType } from "lib/types"

const key = (id: string, type: MediaType) => `owned-${type}-${id}`

export function markOwned(id: string, type: MediaType) {
  LocalStorage.set(key(id, type), true)
}

export function isOwned(id: string, type: MediaType): boolean {
  return !!LocalStorage.getItem<boolean>(key(id, type))
}

export function clearOwned(id: string, type: MediaType) {
  LocalStorage.remove(key(id, type))
}