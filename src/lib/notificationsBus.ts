const EVENT_NAME = "notifications:seen"

type NotificationsSeenDetail = {
  ids: string[]
}

export function emitNotificationsSeen(ids: string[]): void {
  if (!ids || ids.length === 0) return
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<NotificationsSeenDetail>(EVENT_NAME, { detail: { ids } }))
}

export function listenNotificationsSeen(handler: (ids: string[]) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const wrapped = (event: Event) => {
    const detail = (event as CustomEvent<NotificationsSeenDetail>).detail
    if (!detail || !Array.isArray(detail.ids) || detail.ids.length === 0) return
    handler(detail.ids)
  }
  window.addEventListener(EVENT_NAME, wrapped)
  return () => window.removeEventListener(EVENT_NAME, wrapped)
}
