import { metaPixel, type StandardEvent } from "./metaPixel"
import { generateEventId } from "./metaAttribution"

export interface TrackMetaEventOptions {
  eventId?: string
}

const standardEvents = new Set<StandardEvent>([
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "InitiateCheckout",
  "Lead",
  "Purchase",
  "Schedule",
  "Search",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "ViewContent",
])

export function trackMetaEvent(name: string, custom_data?: Record<string, any>, opts?: TrackMetaEventOptions): void {
  const event_id = opts?.eventId || generateEventId()
  const payload = { ...(custom_data || {}), event_id }
  try {
    if (standardEvents.has(name as StandardEvent)) {
      metaPixel.track(name as StandardEvent, payload as any)
    } else {
      metaPixel.trackCustom(name, payload as any)
    }
  } catch {
    // no-op
  }
}

