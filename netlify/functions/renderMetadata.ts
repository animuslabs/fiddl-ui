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
    image: "https://alpha.fiddl.art/.netlify/images?url=https://api.fiddl.art/images/27ec020b-8b85-46ef-ae20-c8f72eff646b-lg.webp",
  }
}

const handler: Handler = builder(async (event) => {
  const { path, queryStringParameters, headers } = event

  const dynamicId = path?.split("/").pop() || ""
  const index = queryStringParameters?.index || "1"

  // Generate metadata
  const pageData = generateMetadata(dynamicId, index)

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
        <title>${pageData.title}</title>
        <script>
          // Redirect only if not already on the main SPA
          const spaUrl = "https://alpha.fiddl.art${path}?index=${index}";
          if (window.location.href !== spaUrl) {
            window.location.replace(spaUrl);
          }
        </script>
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
