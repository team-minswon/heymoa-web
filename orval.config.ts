import { defineConfig } from "orval";

export default defineConfig({
  petstore: {
    input: {
      target: "https://petstore3.swagger.io/api/v3/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./lib/api/generated/endpoints.ts",
      schemas: "./lib/api/generated/models",
      client: "react-query",
      httpClient: "fetch",
      clean: ["./lib/api/generated"],
      formatter: "prettier",
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
      override: {
        mutator: {
          path: "./lib/api/fetcher.ts",
          name: "apiFetch",
        },
      },
    },
  },
});
