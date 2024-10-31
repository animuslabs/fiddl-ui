import { Handler, builder } from "@netlify/functions"

interface Metadata {
  title: string
  description: string
  image: string
}

const generateMetadata = (dynamicId: string, index: string): Metadata => {
  return {
    title: `Page for ${dynamicId} - Index ${index}`,
    description: `This is a description for ${dynamicId} at index ${index}.`,
    image: "https://api.fiddl.art/images/27ec020b-8b85-46ef-ae20-c8f72eff646b-md.webp",
  }
}

const handler: Handler = builder(async (event) => {
  const { path, queryStringParameters, headers } = event

  const dynamicId = path?.split("/").pop() || ""
  const index = queryStringParameters?.index || "1"

  const pageData = generateMetadata(dynamicId, index)

  const userAgent = headers["user-agent"] || ""
  const referer = headers["referer"] || ""

  // Bot detection based on User-Agent, Referer, and webdriver indicator
  const isBot = /bot|crawl|slurp|spider|mediapartners/i.test(userAgent) || !referer || referer.includes("telegram") || referer.includes("facebook")

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta property="og:title" content="${pageData.title}" />
        <meta property="og:description" content="${pageData.description}" />
        <meta property="og:image" content="${pageData.image}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://alpha.fiddl.art${path}?index=${index}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${pageData.title}" />
        <meta name="twitter:description" content="${pageData.description}" />
        <meta name="twitter:image" content="${pageData.image}" />
        <title>${pageData.title}</title>
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
