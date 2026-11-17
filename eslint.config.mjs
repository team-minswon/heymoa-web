import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 짧은 지연 timer 로 실행 순서를 미루는 우회를 막는다. 시간이 기능인 timer(토스트 되돌리기·타임아웃·디바운스)는 100ms 이상이라 걸리지 않는다.
const SHORT_TIMER_MESSAGE =
  "100ms 미만 setTimeout 으로 렌더·effect 순서를 미루지 마세요. 첫 렌더 여부는 상태로, effect 안 상태 연쇄는 reducer·이벤트 핸들러로 옮겨 원인을 고칩니다.";
const shortTimer = (callee) => [
  {
    selector: `CallExpression[${callee}][arguments.length=1]`,
    message: SHORT_TIMER_MESSAGE,
  },
  {
    selector: `CallExpression[${callee}][arguments.1.type='Literal'][arguments.1.value<100]`,
    message: SHORT_TIMER_MESSAGE,
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 8,
        },
      ],
      "no-warning-comments": [
        "error",
        { terms: ["todo", "fixme", "hack", "xxx"], location: "start" },
      ],
    },
  },
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
    ],
    ignores: ["lib/mocks/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...shortTimer("callee.name='setTimeout'"),
        ...shortTimer("callee.property.name='setTimeout'"),
      ],
    },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/(components/(?!ui/)|lib/(?!utils$|ui/|format/|i18n/))",
              message:
                "components/ui 는 제품 의미를 모릅니다(harness rules/architecture.md). 제품 코드를 import 하지 말고 props 로 받으세요.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "apps/desktop/**",
    ".worktrees/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
