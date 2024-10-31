import { Handler, builder } from "@netlify/functions"
// import { shortIdToLong } from "./util"

interface Metadata {
  title: string
  description: string
  image: string
}

const generateMetadata = async (dynamicId: string, index: string): Promise<Metadata> => {
  return {
    title: `Page for ${dynamicId} - Index ${index}`,
    description: `This is a description for ${dynamicId} at index ${index}.`,
    image: "https://eospowerup.io/eospowerupio.jpg",
  }
}

const handler: Handler = builder(async (event) => {
  const { path, queryStringParameters, headers } = event
  const queryParamsString = queryStringParameters.toString()
  const dynamicId = path?.split("/").pop() || ""
  const index = queryStringParameters?.index || "1"

  const pageData = await generateMetadata(dynamicId, index)

  const userAgent = headers["user-agent"] || ""
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|linkedinbot|embedly|quora|pinterest|reddit|slackbot|twitterbot|whatsapp/i.test(userAgent)

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <!DOCTYPE html>
      <html>
      <head>
      <!-- Primary Meta Tags -->
      <title>Page for StxXwHQySwGBzFrsGFJKIQ - Index 1</title>
      <meta name="title" content="Page for StxXwHQySwGBzFrsGFJKIQ - Index 1" />
      <meta name="description" content="This is a description for StxXwHQySwGBzFrsGFJKIQ at index 1." />

      <!-- Open Graph / Facebook -->
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://alpha.fiddl.art/r/StxXwHQySwGBzFrsGFJKIQ?index=0&referredBy=JD" />
      <meta property="og:title" content="Page for StxXwHQySwGBzFrsGFJKIQ - Index 1" />
      <meta property="og:description" content="This is a description for StxXwHQySwGBzFrsGFJKIQ at index 1." />
      <meta property="og:image" content="https://metatags.io/images/meta-tags.png" />

      <!-- Twitter -->
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content="https://alpha.fiddl.art/r/StxXwHQySwGBzFrsGFJKIQ?index=0&referredBy=JD" />
      <meta property="twitter:title" content="Page for StxXwHQySwGBzFrsGFJKIQ - Index 1" />
      <meta property="twitter:description" content="This is a description for StxXwHQySwGBzFrsGFJKIQ at index 1." />
      <meta property="twitter:image" content="https://metatags.io/images/meta-tags.png" />

      <!-- Meta Tags Generated with https://metatags.io -->
        ${
          isBot
            ? ""
            : `
          <script>
            window.location.replace("https://alpha.fiddl.art${path}?index=${index}");
          </script>
        `
        }
      </head>
      <body>
        <h1>${pageData.title}</h1>
        <p>${pageData.description}</p>
        <img src="${pageData.image}" alt="${pageData.title}" />
      </body>
      </html>
    `,
  }
})

export { handler }
