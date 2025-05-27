import { defineConfig } from "orval"

export default defineConfig({
  api: {
    input: "../fiddl-server/openapi.json",
    output: {
      target: "./src/lib/orval.ts",
      client: "vue-query",
    },
  },
})
