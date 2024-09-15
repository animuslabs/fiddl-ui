import { loadScript, PayPalNamespace } from "@paypal/paypal-js"
const payPalID = process.env.PAYPAL_ID

export async function loadPayPal() {
  if (!payPalID) {
    throw new Error("No PayPal Client ID found in environment variables")
  }

  try {
    // Check if PayPal is already loaded
    if (window.paypal) {
      return window.paypal
    }

    // Load the PayPal script
    const paypal = await loadScript({
      clientId: payPalID,
      currency: "USD",
      components: ["buttons", "funding-eligibility"],
      // enableFunding: ["venmo"],
      intent: "capture",
    })

    if (!paypal) {
      throw new Error("Failed to load PayPal SDK")
    }

    return paypal
  } catch (error) {
    console.error("PayPal SDK load error:", error)
    throw error
  }
}
