import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// `next/root-params` 는 Next 컴파일러가 바꿔 끼우는 자리표시 모듈이라 vitest 에서는 던진다.
// 마케팅 루트의 기본 언어(한국어)로 둔다. 영어판을 보는 시험은 자기 파일에서 다시 목한다.
vi.mock("next/root-params", () => ({ lang: async () => "ko" }));

// 날짜·숫자 표시 locale 은 next-intl Provider 에서 읽는다(`useDisplayLocale`, APP-1285). 운영에서는 `AppShell` 이 늘
// Provider 를 세우지만, Provider 없이 그리는 컴포넌트 시험이 많아 기본을 한국어로 둔다. 영어 화면을 보는 시험은
// `vi.unmock("@/lib/i18n/use-display-locale")` 하고 Provider 로 감싼다.
vi.mock("@/lib/i18n/use-display-locale", () => ({
  useDisplayLocale: () => "ko-KR",
}));
