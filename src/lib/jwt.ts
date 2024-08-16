const TOKEN_STORAGE_KEY = "jwtToken"
import { LocalStorage } from "quasar"
export const jwt = {
  read() {
    return LocalStorage.getItem<{ userId:string, token:string }>(TOKEN_STORAGE_KEY)
  },
  save(data:{ userId:string, token:string }) {
    LocalStorage.set(TOKEN_STORAGE_KEY, data)
  },
  remove() {
    LocalStorage.remove(TOKEN_STORAGE_KEY)
  }
}
