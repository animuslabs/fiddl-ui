import { Context } from "@netlify/edge-functions"

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)
  // request.
  // Since this function is only triggered by the path defined in netlify.toml, no need to check the URL path
  const metaTags = `
    <meta name="description" content="Special content for ${url.pathname}">
    <meta property="og:title" content="Custom Page ${url.pathname}">
    <meta property="og:description" content="Detailed description for ${url.pathname}">
  `

  const response = await context.next()

  // Modify the HTML response
  let text = await response.text()
  text = text.replace("</head>", `${metaTags}</head>`)

  return new Response(text, response)
}
