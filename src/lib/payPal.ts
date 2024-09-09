import { loadScript, PayPalNamespace } from "@paypal/paypal-js";
const payPalID = process.env.PAYPAL_ID;
if (!payPalID) throw new Error("No PayPal Client ID found in environment variables")
export const payPal = await loadScript({
  clientId: payPalID,
  dataSdkIntegrationSource: "integrationbuilder_sc",
  currency: "USD",
  components: ["buttons"],
  enableFunding: ["venmo"],
});

