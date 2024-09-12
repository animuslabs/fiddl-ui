import { loadScript, PayPalNamespace } from "@paypal/paypal-js";
const payPalID = process.env.PAYPAL_ID;

export function loadPayPal() {
  if (!payPalID) throw new Error("No PayPal Client ID found in environment variables")
  return loadScript({
    clientId: payPalID,
    dataSdkIntegrationSource: "integrationbuilder_sc",
    currency: "USD",
    components: ["buttons"],
    enableFunding: ["venmo"],
  })
}

