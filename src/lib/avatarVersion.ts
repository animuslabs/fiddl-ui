const PREFIX = "avatarV:"

function key(userId: string) {
  return `${PREFIX}${userId}`
}

export function getAvatarVersion(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId))
  } catch {
    return null
  }
}

export function setAvatarVersion(userId: string, v: string) {
  try {
    localStorage.setItem(key(userId), v)
  } catch {}
}

export function bumpAvatarVersion(userId: string): string {
  const v = String(Date.now())
  setAvatarVersion(userId, v)
  return v
}

export function clearAvatarVersion(userId: string) {
  try {
    localStorage.removeItem(key(userId))
  } catch {}
}

