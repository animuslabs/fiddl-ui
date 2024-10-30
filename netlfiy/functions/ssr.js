// netlify/functions/ssr.js
import server from "../../dist/ssr/server/server-entry.js"

const handler = async (event, context) => {
  // Emulate Express.js req and res objects
  const req = {
    url: event.rawUrl,
    headers: event.headers,
    method: event.httpMethod,
    body: event.body,
    query: event.queryStringParameters,
  }

  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      res.statusCode = statusCode
      res.headers = headers
    },
    end(body) {
      res.body = body
    },
  }

  await server(req, res)

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
  }
}
export { handler }
