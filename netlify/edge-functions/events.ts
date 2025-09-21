import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)

    const pageTitle = "Notifications & Events | Fiddl.art"
    const description =
      "Review notifications from the Fiddl community, mark updates as seen, and stay informed about activity around your AI art."

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
          buildEventsFaqSchema(`${url.origin}${url.pathname}`),
          buildEventsHowToSchema(`${url.origin}${url.pathname}`),
        ],
        htmlBlocks: [buildStaticTopNavHtml(), buildEventsIntroHtml(), buildEventsManagementHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "events", e)
    return context.next()
  }
}

function buildEventsIntroHtml(): string {
  return `
  <section id="events-intro">
    <h1>Notifications &amp; Events</h1>
    <p class="lead">
      Keep track of new followers, mission updates, collaboration invites, and comments on your creations without leaving the app.
    </p>
    <ul class="quick-facts">
      <li>Filter notifications by type to focus on the activity that matters</li>
      <li>Highlight unseen alerts so you never miss an important update</li>
      <li>Jump straight to the related profile, request, or model from each event</li>
    </ul>
  </section>
  `
}

function buildEventsManagementHtml(): string {
  return `
  <section id="events-management">
    <h2>Manage Your Activity Feed</h2>
    <p>
      The Events tab centralizes everything happening around your account. Use the unseen filter to review new alerts in seconds,
      or narrow the list to comments, mission rewards, and collaboration invitations. Pagination keeps long histories fast and easy to scan.
    </p>
    <h2>Stay in Control</h2>
    <p>
      Mark notifications as seen once you have reviewed them, or open individual items to respond. Progress syncs across devices so your
      dashboard always reflects what you have already handled.
    </p>
  </section>
  `
}

function buildEventsFaqSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What can I find on the Fiddl Events page?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Events page lists notifications about your AI creations including comments, new followers, mission milestones, and collaboration invites.",
        },
      },
      {
        "@type": "Question",
        name: "How do I filter my notifications?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Use the type selector to focus on specific notification categories such as comments, missions, or follows."
        },
      },
      {
        "@type": "Question",
        name: "Can I mark notifications as seen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Toggle each notification or use the Mark all seen option to clear your queue once you have reviewed everything.",
        },
      },
    ],
    mainEntityOfPage: pageUrl,
  }

  return JSON.stringify(schema)
}

function buildEventsHowToSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to manage notifications on Fiddl",
    description: "Follow these steps to review, filter, and clear notifications from your Fiddl account.",
    url: pageUrl,
    step: [
      {
        "@type": "HowToStep",
        name: "Open Events",
        text: "Log in and open the Events tab in the Fiddl app to load your feed.",
      },
      {
        "@type": "HowToStep",
        name: "Filter activity",
        text: "Use the Show unseen toggle or type selector to focus on the notifications you need to action.",
      },
      {
        "@type": "HowToStep",
        name: "Review and mark done",
        text: "Open any item to respond, then mark it as seen so your feed stays organized across devices.",
      },
    ],
  }

  return JSON.stringify(schema)
}

export default safeEdge(handler, "events")

export const config: Config = {
  path: "/events",
}
