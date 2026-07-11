import { defineConfig } from "orval";

export default defineConfig({
  heymoa: {
    input: {
      target: "./openapi3.yml",
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
      mock: {
        indexMockFiles: true,
        generators: [
          { type: "msw", useExamples: true },
          { type: "faker", useExamples: true, schemas: true },
        ],
      },
      override: {
        mutator: {
          path: "./lib/api/fetcher.ts",
          name: "apiFetch",
        },
      },
    },
  },
});
