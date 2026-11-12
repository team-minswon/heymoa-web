import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import { BusinessInfoLine } from "@/components/heymoa/landing/business-info";
import { messagesFor } from "@/i18n/messages";
import { BUSINESS_INFO } from "@/lib/business-info";

const EMPTY = Object.fromEntries(
  Object.keys(BUSINESS_INFO).map((key) => [key, ""])
) as typeof BUSINESS_INFO;

const renderLine = (info = EMPTY) =>
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
      ...EMPTY,
      name: "헤이모아",
      registration: "123-45-67890",
    });
    const list = screen.getByLabelText("사업자 정보");
    expect(list).toHaveTextContent("상호헤이모아");
    expect(list).toHaveTextContent("사업자등록번호123-45-67890");
    expect(list).not.toHaveTextContent("대표자");
  });

  it("실제 값에서 신고 전인 통신판매업 신고번호는 보이지 않는다", () => {
    renderLine(BUSINESS_INFO);
    const list = screen.getByLabelText("사업자 정보");
    expect(list).toHaveTextContent("상호헤이모아");
    expect(list).toHaveTextContent("대표자");
    expect(list).toHaveTextContent("사업자등록번호");
    expect(list).not.toHaveTextContent("통신판매업 신고번호");
  });
});
