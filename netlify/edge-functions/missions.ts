import type { Context, Config } from "@netlify/edge-functions"
import { buildPageResponse } from "./lib/page.ts"
import { buildStaticTopNavHtml } from "./lib/util.ts"
import { safeEdge, logEdgeError } from "./lib/safe.ts"

const handler = async (request: Request, context: Context) => {
  try {
    const url = new URL(request.url)

    const pageTitle = "Missions | Fiddl.art"
    const description =
      "Complete creative tasks to earn points and badges on Fiddl.art. Progress is tracked automatically. Claim rewards when you reach 100%."

    return await buildPageResponse({
      request,
      context,
      pageTitle,
      social: {
        description,
        imageUrl: "https://app.fiddl.art/fiddlLogo.webp",
        ogType: "website",
        twitterCard: "summary",
      },
      blocks: {
        jsonLd: [buildMissionsFaqSchema(`${url.origin}${url.pathname}`), buildMissionsHowToSchema(`${url.origin}${url.pathname}`)],
        htmlBlocks: [buildStaticTopNavHtml(), buildMissionsIntroHtml(), buildMissionsDetailsHtml()],
      },
    })
  } catch (e) {
    logEdgeError(request, context, "missions", e)
    return context.next()
  }
}

function buildMissionsIntroHtml(): string {
  return `
  <section id="missions-intro">
    <p class="lead">
      Missions are short challenges that guide you to explore features, improve your skills, and earn rewards on Fiddl.art.
    </p>
    <ul class="quick-facts">
      <li>Track progress automatically as you create and explore</li>
      <li>Claim rewards when you reach 100% on a mission</li>
      <li>Earn points and unique badges for your profile</li>
    </ul>
    <p>
      To view available missions and your progress, open the Missions page in the app. You’ll see claimable missions first,
      followed by in-progress missions.
    </p>
  </section>
  `
}

function buildMissionsDetailsHtml(): string {
  return `
  <section id="missions-how-it-works">
    <h2>How Missions Work</h2>
    <ol>
      <li><strong>Browse Missions:</strong> See available missions and what you can earn.</li>
      <li><strong>Create & Explore:</strong> Use Fiddl tools to fulfill the mission steps. Progress updates automatically.</li>
      <li><strong>Reach 100%:</strong> Once a mission shows 100%, your reward becomes claimable.</li>
      <li><strong>Claim Rewards:</strong> Click “Claim” to receive points and/or badges instantly.</li>
      <li><strong>Enjoy Perks:</strong> Points can be used in-app and badges showcase your achievements.</li>
    </ol>
  </section>

  <section id="missions-rewards">
    <h2>Rewards</h2>
    <ul>
      <li><strong>Points:</strong> Earn Fiddl points for completing specific missions.</li>
      <li><strong>Badges:</strong> Unlock collectible badges that appear on your profile.</li>
    </ul>
    <p>
      If you already own a badge from a mission, it will be marked as “Owned” after you claim. Your points balance updates right away.
    </p>
  </section>

  <section id="missions-eligibility">
    <h2>Eligibility & Rules</h2>
    <ul>
      <li>You must be logged in to track progress and claim rewards.</li>
      <li>Some missions may have time windows, content requirements, or model restrictions.</li>
      <li>If a reward is already claimed, the mission will show as claimed for your account.</li>
    </ul>
  </section>

  <section id="missions-get-started">
    <h2>Get Started</h2>
    <p>
      Sign in and open <a href="/missions">Missions</a> in the app. Complete tasks, watch your progress rise, and claim your rewards when you’re done.
    </p>
    <p>
      New missions are added regularly. Check back often to earn more points and badges.
    </p>
  </section>
  `
}

function buildMissionsFaqSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What are Missions on Fiddl.art?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Missions are guided challenges that help you explore features and earn rewards like points and badges. Your progress is tracked automatically while you create and browse.",
        },
      },
      {
        "@type": "Question",
        name: "How do I claim a mission reward?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Open the Missions page in the app and press Claim on any mission that shows 100% progress. Rewards are granted instantly.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need an account to participate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. You need to be logged in to track progress and claim rewards.",
        },
      },
      {
        "@type": "Question",
        name: "What kind of rewards can I earn?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can earn Fiddl points and collectible badges. Points may be used in-app, and badges are displayed on your profile.",
        },
      },
      {
        "@type": "Question",
        name: "Why is my mission already marked as claimed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If you previously completed or claimed a reward for a mission, it may appear as already claimed for your account.",
        },
      },
    ],
    mainEntityOfPage: pageUrl,
  }

  return JSON.stringify(schema)
}

function buildMissionsHowToSchema(pageUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to complete Missions on Fiddl.art",
    description: "Follow these steps to complete missions, track progress, and claim rewards.",
    totalTime: "PT1M",
    step: [
      {
        "@type": "HowToStep",
        name: "Log in",
        text: "Log in to your Fiddl account so progress and rewards can be tracked.",
      },
      {
        "@type": "HowToStep",
        name: "Open Missions",
        text: "Go to the Missions page to see active and claimable missions.",
      },
      {
        "@type": "HowToStep",
        name: "Complete tasks",
        text: "Use Fiddl creation tools and features to complete the mission requirements.",
      },
      {
        "@type": "HowToStep",
        name: "Claim rewards",
        text: "When progress reaches 100%, press Claim to receive your points and badges.",
      },
    ],
    url: pageUrl,
    tool: [
      { "@type": "HowToTool", name: "Fiddl Create tools" },
      { "@type": "HowToTool", name: "Fiddl Missions page" },
    ],
  }

  return JSON.stringify(schema)
}

export default safeEdge(handler, "missions")

export const config: Config = {
  path: "/missions",
}