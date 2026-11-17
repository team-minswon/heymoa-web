import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

if (typeof window !== "undefined") {
  HTMLMediaElement.prototype.pause = () => {};
  window.scrollTo = () => {};
  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest?.("a[href]:not([href^='#'])"))
      event.preventDefault();
  });
}

vi.mock("next/root-params", () => ({ lang: async () => "ko" }));

vi.mock("@/lib/i18n/use-display-locale", () => ({
  useDisplayLocale: () => "ko-KR",
}));

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
