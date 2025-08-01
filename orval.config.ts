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
      override: {
        mutator: {
          path: "./netlify/edge-functions/lib/fetcher.ts",
          name: "fetcher",
          extension: ".ts",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
