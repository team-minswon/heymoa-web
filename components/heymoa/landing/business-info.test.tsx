import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import { BusinessInfoLine } from "@/components/heymoa/landing/business-info";
import { messagesFor } from "@/i18n/messages";
import { BUSINESS_INFO } from "@/lib/business-info";

const renderLine = (info = BUSINESS_INFO) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
      <BusinessInfoLine info={info} />
    </NextIntlClientProvider>
  );

afterEach(cleanup);

describe("BusinessInfoLine", () => {
  it("상호가 비어 있으면 아무것도 그리지 않는다", () => {
    const { container } = renderLine();
    expect(container).toBeEmptyDOMElement();
  });

  it("값을 넣으면 값이 있는 항목만 라벨과 함께 보인다", () => {
    renderLine({
      ...BUSINESS_INFO,
      name: "헤이모아",
      registration: "123-45-67890",
    });
    const list = screen.getByLabelText("사업자 정보");
    expect(list).toHaveTextContent("상호헤이모아");
    expect(list).toHaveTextContent("사업자등록번호123-45-67890");
    expect(list).not.toHaveTextContent("대표자");
  });
});
