import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/i18n/use-display-locale");

import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

function wrapperFor(locale: "ko" | "en") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

describe("useDisplayLocale", () => {
  it("화면 언어를 표시 locale 로 바꾼다", () => {
    expect(
      renderHook(useDisplayLocale, { wrapper: wrapperFor("en") }).result.current
    ).toBe("en-US");
    expect(
      renderHook(useDisplayLocale, { wrapper: wrapperFor("ko") }).result.current
    ).toBe("ko-KR");
  });
});
