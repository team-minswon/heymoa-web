import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// 아래는 jsdom 이 구현하지 않은 것을 받는다. `@vitest-environment node` 인 파일에는 DOM 이 없어 건너뛴다.
if (typeof window !== "undefined") {
  // jsdom 은 미디어 재생을 구현하지 않아 `pause()` 가 「Not implemented」를 찍는다. 단언하는 시험은 자기 `vi.fn()` 으로 덮는다.
  HTMLMediaElement.prototype.pause = () => {};
  // jsdom 에 없는 `window.scrollTo` 를 motion 이 부른다.
  window.scrollTo = () => {};
  // jsdom 은 문서 이동을 못 해 링크를 누르면 「navigation to another Document」를 찍는다. React 핸들러가 먼저 돌도록
  // 버블 단계에서 막고, 같은 문서 안 이동(`#…`)은 `help-motion` 이 직접 다뤄서 건드리지 않는다.
  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest?.("a[href]:not([href^='#'])"))
      event.preventDefault();
  });
}

// `next/root-params` 는 Next 컴파일러가 바꿔 끼우는 자리표시 모듈이라 vitest 에서는 던진다.
// 마케팅 루트의 기본 언어(한국어)로 둔다. 영어판을 보는 시험은 자기 파일에서 다시 목한다.
vi.mock("next/root-params", () => ({ lang: async () => "ko" }));

// 날짜·숫자 표시 locale 은 next-intl Provider 에서 읽는다(`useDisplayLocale`, APP-1285). 운영에서는 `AppShell` 이 늘
// Provider 를 세우지만, Provider 없이 그리는 컴포넌트 시험이 많아 기본을 한국어로 둔다. 영어 화면을 보는 시험은
// `vi.unmock("@/lib/i18n/use-display-locale")` 하고 Provider 로 감싼다.
vi.mock("@/lib/i18n/use-display-locale", () => ({
  useDisplayLocale: () => "ko-KR",
}));

// 컴포넌트가 `useTranslations` 로 문구를 읽는다(APP-1286). 운영에서는 `AppShell` 이 늘 Provider 를 세우므로, 시험도
// `render`·`renderHook` 의 기본 wrapper 로 한국어 Provider 를 씌운다. 시험이 자기 `wrapper` 를 넘기면 그 안쪽에 둔다 —
// 영어를 보는 시험은 자기 Provider(`intlWrapper("en")`)가 안쪽에서 이긴다.
vi.mock("@testing-library/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@testing-library/react")>();
  const { createElement } = await import("react");
  const { NextIntlClientProvider } = await vi.importActual<typeof import("next-intl")>("next-intl");
  const { messagesFor } = await import("@/i18n/messages");
  const messages = messagesFor("ko");

  type Wrapper = React.JSXElementConstructor<{ children: React.ReactNode }>;
  const withIntl = (Inner?: Wrapper) =>
    function IntlTestWrapper({ children }: { children: React.ReactNode }) {
      return createElement(NextIntlClientProvider, {
        locale: "ko",
        messages,
        timeZone: "Asia/Seoul",
        children: Inner ? createElement(Inner, null, children) : children,
      });
    };

  return {
    ...actual,
    render: ((ui: React.ReactNode, options: Parameters<typeof actual.render>[1] = {}) =>
      actual.render(ui, {
        ...options,
        wrapper: withIntl(options.wrapper as Wrapper | undefined),
      })) as typeof actual.render,
    renderHook: ((callback: (props: unknown) => unknown, options: Record<string, unknown> = {}) =>
      actual.renderHook(callback, {
        ...options,
        wrapper: withIntl(options.wrapper as Wrapper | undefined),
      })) as typeof actual.renderHook,
  };
});
