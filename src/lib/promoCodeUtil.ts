import { shortIdToLong, catchErr } from "lib/util"
import router from "../router"
import { useUserAuth } from "src/stores/userAuth"
import { promoClaimPromoCode, promoGetPromoCodeDetails } from "lib/orval"
import { Dialog, Notify } from "quasar"
import PrivyLogin from "src/components/dialogs/PrivyLogin.vue"

export function getQueryParam(key: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(key)

  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function removeQueryParam(key: string): void {
  const query = { ...router.currentRoute.value.query }
  delete query[key]
  void router.replace({ query }).catch(console.error)
}

/**
 * Registry for page-specific promo messages (keyed by route name)
 * Add or override entries via registerPromoMessageRenderer().
 */
const promoMessageRenderers: Record<string, (p: number) => string> = {
  magicMirror: (p) =>
    `<div style="text-align:center">
      <img src="/OGImage-1.jpg" alt="Magic Mirror" style="max-width:100%; border-radius:8px; margin-bottom:8px;" />
      <div style="margin-top:6px;">
        <strong>You have received ${p} Fiddl Points!</strong><br/>
        Use them to unlock Magic Mirror looks and features faster.
      </div>
    </div>`,
}

/**
 * Public API to extend page-specific promo copy from anywhere in the app.
 * Example:
 *   registerPromoMessageRenderer('browse', p => `<strong>${p} points!</strong> Check out the Browse page perks.`)
 */
export function registerPromoMessageRenderer(routeName: string, renderer: (points: number) => string) {
  promoMessageRenderers[routeName] = renderer
}

/**
 * Page-specific HTML content with fallback.
 */
function buildPageSpecificHtml(points: number): string {
  const routeName = String(router.currentRoute.value.name || "")
  const render = promoMessageRenderers[routeName] || ((p) => `<strong>You have received ${p} Fiddl Points!</strong>`)
  return render(points)
}

async function claimNow(id: string, userAuth = useUserAuth()) {
  await promoClaimPromoCode({ id })
  await userAuth.loadUserData()
  removeQueryParam("claimCode")
  Notify.create({ message: "Promo claimed successfully", color: "positive", icon: "check" })
}

/**
 * Opens PrivyLogin in a dialog and claims points once the user logs in.
 * Works even if the login flow closes this dialog early (email code prompt),
 * by subscribing to userAuth.loggedIn and claiming when it flips true.
 */
function openLoginAndClaim(id: string) {
  const userAuth = useUserAuth()

  // If already logged in, claim immediately
  if (userAuth.loggedIn) {
    void claimNow(id, userAuth).catch(catchErr)
    return
  }

  // Subscribe for login and auto-claim
  let unsub: null | (() => void) = null
  let timeoutId: number | null = null
  const stop = () => {
    if (unsub) {
      unsub()
      unsub = null
    }
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  unsub = userAuth.$subscribe((_mutation, state) => {
    if (state.loggedIn) {
      stop()
      void claimNow(id, userAuth).catch(catchErr)
    }
  })
  // Auto-clean after 3 minutes to avoid stale listeners
  timeoutId = window.setTimeout(stop, 3 * 60 * 1000)

  // Show login dialog; close when the child emits "close"
  const dlg = Dialog.create({
    component: PrivyLogin,
    componentProps: {
      onClose: () => dlg.hide(),
    },
    persistent: true,
  }).onDismiss(() => {
    // keep subscription alive briefly; actual clean handled by timeout or claim
  })
}

export async function handleClaimCode(isLoggedIn: boolean) {
  try {
    const claimCode = getQueryParam("claimCode")
    if (!claimCode) return

    const id = shortIdToLong(claimCode)
    const { data: promoDetails } = await promoGetPromoCodeDetails({ id })
    if (promoDetails.claimedByUserId) {
      removeQueryParam("claimCode")
      return
    }

    const htmlMsg = buildPageSpecificHtml(promoDetails.points)

    if (isLoggedIn) {
      const userAuth = useUserAuth()
      Dialog.create({
        html: true,
        message: `${htmlMsg}<div style="margin-top:8px;">Claim these points to your account?</div>`,
        ok: { label: "Claim" },
        cancel: "No Thanks",
      }).onOk(async () => {
        try {
          await claimNow(id, userAuth)
        } catch (err: any) {
          catchErr(err)
        }
      })
      return
    }

    Dialog.create({
      html: true,
      message: `${htmlMsg}<div style="margin-top:8px;">Login/Register to claim these points or continue as a guest.</div>`,
      ok: { label: "Login / Register" },
      cancel: "Continue as Guest",
      noBackdropDismiss: true,
    })
      .onOk(() => {
        openLoginAndClaim(id)
      })
      .onCancel(async () => {
        try {
          const userAuth = useUserAuth()
          await userAuth.registerWithPromoCode(id)
          removeQueryParam("claimCode")
          Notify.create({ message: "Promotional account created and points claimed", color: "positive", icon: "check" })
        } catch (err: any) {
          catchErr(err)
        }
      })
  } catch (err: any) {
    console.error("handleClaimCodeError:", err)
  }
}
