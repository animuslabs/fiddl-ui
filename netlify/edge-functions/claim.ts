import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml, escapeHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)
    const [, , claimShortId] = url.pathname.split("/")

    const hasClaimCode = Boolean(claimShortId)
    const pageTitle = hasClaimCode ? `Claim Promo Code ${claimShortId} | Fiddl.art` : "Claim Promo Codes | Fiddl.art"
    const description = hasClaimCode
      ? `Redeem the ${claimShortId} promo code to unlock Fiddl art rewards and points instantly.`
      : "Redeem Fiddl promo codes to unlock points, creator perks, and exclusive rewards."

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        title: pageTitle,
        description,
        imageUrl: "https://app.fiddl.art/fiddlSocialCard.jpg",
        ogType: "website",
        twitterCard: "summary",
      },
      blocks: {
        jsonLd: [
          buildClaimHowToSchema(`${url.origin}${url.pathname}`, claimShortId || undefined),
          buildClaimFaqSchema(`${url.origin}${url.pathname}`),
        ],
        htmlBlocks: [buildStaticTopNavHtml(), buildClaimIntroHtml(claimShortId), buildClaimStepsHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "claim", e)
    return context.next()
  }
}

function buildClaimIntroHtml(claimShortId?: string): string {
  const maybeCode = claimShortId
    ? `<p class="claim-code">Promo code ready: <strong>${escapeHtml(claimShortId)}</strong></p>`
    : ""

  return `
  <section id="claim-intro">
    <h1>Claim Promo Codes</h1>
    <p class="lead">
      Redeem invitations, partner perks, and community rewards to boost your Fiddl balance.
    </p>
    ${maybeCode}
    <ul class="quick-facts">
      <li>Claim codes instantly when you are logged in</li>
      <li>Earn points that can be spent on creations, models, and more</li>
      <li>Badge rewards appear on your profile as soon as they are granted</li>
    </ul>
  </section>
  `
}

function buildClaimStepsHtml(): string {
  return `
  <section id="claim-steps">
    <h2>How Claiming Works</h2>
    <ol>
      <li><strong>Open the Claim page:</strong> Visit <a href="/claim">app.fiddl.art/claim</a> while signed in.</li>
      <li><strong>Review the promo value:</strong> The page shows point rewards and badge unlocks tied to the code.</li>
      <li><strong>Click Claim:</strong> Rewards post to your account immediately after confirmation.</li>
    </ol>
    <p>
      Already used codes display as claimed, so you always know whether a reward is still available.
    </p>
  </section>
  `
}

function buildClaimHowToSchema(pageUrl: string, claimShortId?: string): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: claimShortId ? `How to redeem promo code ${claimShortId} on Fiddl` : "How to claim promo codes on Fiddl",
    description: "Redeem promo codes to add points and unlock rewards in seconds.",
    url: pageUrl,
    step: [
      {
        "@type": "HowToStep",
        name: "Log in",
        text: "Sign in to your Fiddl account or create one to redeem rewards.",
      },
      {
        "@type": "HowToStep",
        name: "Open the Claim page",
        text: claimShortId
          ? `Visit the claim link already embedded with the ${claimShortId} code.`
          : "Go to app.fiddl.art/claim and enter your promo code if prompted.",
      },
      {
        "@type": "HowToStep",
        name: "Confirm and claim",
        text: "Review the reward details and press Claim to add the points to your balance.",
      },
    ],
  }

  if (claimShortId) {
    schema.identifier = claimShortId
  }

  return JSON.stringify(schema)
}

function buildClaimFaqSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Do I need to be logged in to redeem a promo code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Promo codes apply to your Fiddl account so you must be signed in before claiming.",
        },
      },
      {
        "@type": "Question",
        name: "What happens after I claim a code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Points or badges tied to the code are added to your account instantly. You will see confirmation on the page and in your balance.",
        },
      },
      {
        "@type": "Question",
        name: "Why does my code show as already claimed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Codes are single-use. If your account already redeemed it, the page will indicate that the reward has been claimed.",
        },
      },
    ],
    mainEntityOfPage: pageUrl,
  }

  return JSON.stringify(schema)
}

export default safeEdge(handler, "claim")

export const config: Config = {
  path: "/claim/*",
}
