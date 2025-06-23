import { defineConfig } from "orval"

export default defineConfig({
  api: {
    input: "../fiddl-server/openapi.json",
    output: {
      target: "./src/lib/orval.ts",
      client: "vue-query",
    },
  },
  edge: {
    input: "../fiddl-server/openapi.json",
    output: {
      target: "./netlify/edge-functions/lib/orval.ts",
      client: "fetch",
      baseUrl: "https://api.fiddl.art/api",
    },
  },
})
