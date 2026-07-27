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
        // msw만 쓴다. faker 제너레이터는 `*.faker.ts` 15파일 1,600여 줄을 만드는데
        // `lib/api/generated` 밖에서 참조가 하나도 없었다(APP-244 감사). 게다가 rule
        // `api-data`가 orval 기본 목 응답 사용을 금지한다 — 무작위 `success: false`가
        // 나와 인증이 깨진다. 쓰면 안 되는 코드를 생성해 두면 덫이 된다.
        generators: [{ type: "msw", useExamples: true }],
      },
      override: {
        query: {
          useSuspenseQuery: true,
          usePrefetch: true,
        },
        mutator: {
          path: "./lib/api/fetcher.ts",
          name: "apiFetch",
        },
      },
    },
  },
});
