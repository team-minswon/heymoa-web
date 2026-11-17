import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArchivedPrivacyPage, {
  generateStaticParams as privacyVersions,
} from "@/app/[lang]/privacy/[version]/page";
import PrivacyPage, {
  generateMetadata as privacyMetadata,
} from "@/app/[lang]/privacy/page";
import TermsPage, {
  generateMetadata as termsMetadata,
} from "@/app/[lang]/terms/page";
import type { Locale } from "@/lib/i18n/locales";

const route = vi.hoisted(() => ({ locale: "ko" as Locale }));
vi.mock("@/lib/i18n/current", () => ({
  marketingLocale: async () => route.locale,
}));

const renderPage = async (Page: () => Promise<React.ReactElement>, locale: Locale) => {
  route.locale = locale;
  return render(await Page());
};

const HANGUL = /[가-힣]/;

describe("HeyMoa legal pages", () => {
  // 언마운트하지 않으면 React scheduler 의 setImmediate 작업이 jsdom 이 헐린 뒤 돌아 exit code 가 1 이 됩니다.
  afterEach(cleanup);

  it("describes meeting transcription data on the privacy page", async () => {
    await renderPage(PrivacyPage, "ko");

    expect(
      screen.getByRole("heading", { name: "개인정보 처리방침", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Soniox Inc\.\s*실시간 음성 인식/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /pyannote\.ai\)\s*화자 구분/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /TypeSafe AI, Inc\.\s*AI 모델\(OpenRouter 재위탁\)/ })).toBeVisible();
    expect(screen.queryByText(/ElevenLabs/)).not.toBeInTheDocument();
    expect(screen.queryByText(/이미지 검사|진짜그림/)).not.toBeInTheDocument();
    expect(screen.getByText(/PostHog Inc\./)).toBeVisible();
    expect(document.body.textContent).not.toMatch(/확인 중/);
    expect(document.getElementById("section-5")).toHaveTextContent("제5조 (자동 수집 장치와 거부 방법)");
    expect(screen.getByText(/서버에서 처리된 기록은/)).toBeVisible();
    expect(document.body.textContent).toMatch(/운영 알림에 쓰는 이용자 이름/);
    expect(document.body.textContent).toMatch(/운영 알림과 문의 처리/);
    expect(document.getElementById("section-6")).toHaveTextContent(/늦어도 저장한 날부터 30일/);
    expect(document.getElementById("section-6")).toHaveTextContent(/나가거나 탈퇴해도 그 워크스페이스의 지난 회의 기록에는 이름이 남습니다/);
    expect(document.getElementById("section-1")).toHaveTextContent("서비스 이용 기록");
    expect(document.body.textContent).not.toMatch(/【/);
    expect(document.body.textContent).toContain("team.minswon@gmail.com로 보내 주시기 바랍니다.");
    expect(document.body.textContent).not.toMatch(/\{email\}/);
    expect(document.querySelector("article")?.textContent).not.toMatch(/[{}]/);
    expect(document.getElementById("section-10")).toHaveTextContent("김민수");
  });

  it("새 처리방침은 공고·시행일과 이전 판을 보존한 변경표를 보여 줍니다", async () => {
    await renderPage(PrivacyPage, "ko");
    expect(screen.getByText("2026년 11월 11일")).toBeVisible();
    expect(screen.getByText("2026년 11월 18일")).toBeVisible();
    expect(document.getElementById("session-replay-changes")).toHaveTextContent("세션 리플레이는 30일");
    expect(screen.getByRole("link", { name: /2026년 11월 3일/ })).toHaveAttribute("href", "/privacy/2026-11-03");
  });

  it("sets responsible recording expectations in the terms", async () => {
    await renderPage(TermsPage, "ko");

    expect(
      screen.getByRole("heading", { name: "이용약관", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/참석자 고지와 동의/)).toBeVisible();
    expect(
      screen.getAllByRole("navigation", { name: "이용약관 목차" })
    ).toHaveLength(2);
    expect(screen.getByText("공고일")).toBeVisible();
    expect(screen.queryByText("미정")).not.toBeInTheDocument();
    expect(screen.getAllByText("2026년 11월 14일")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "한국어본 보기" })).not.toBeInTheDocument();
  });

  it("약관에 유료·환불 조항이 있고 주문서가 링크하는 #section-13 이 환불 조항이다", async () => {
    await renderPage(TermsPage, "ko");
    const refund = document.getElementById("section-13");
    expect(refund).toHaveTextContent("제13조 (환불)");
    expect(refund).toHaveTextContent(/결제일부터 7일 이내에 환불을 요청하고, 요청한 때까지 그 결제 기간에 워크스페이스 전체가 녹음한 시간의 합계가 20시간 이하이면 결제 금액 전부를 환불합니다/);
    expect(document.getElementById("section-11")).toHaveTextContent("제11조 (자동 갱신)");
    expect(document.getElementById("section-15")).toHaveTextContent("제15조 (약관의 변경과 문의)");
  });

  it("약관에 결제자·이용 기간·결제자 이탈·청약철회·환불 처리 기한을 적는다", async () => {
    await renderPage(TermsPage, "ko");
    const text = (id: string) => document.getElementById(id)?.textContent ?? "";
    expect(text("section-1")).toMatch(/이 약관은 헤이모아\(대표자 이민형, 이하 'HeyMoa'\)가 제공하는/);
    expect(text("section-10")).toMatch(/카드를 등록한 관리자가 그 구독의 결제자가 됩니다/);
    expect(text("section-10")).toMatch(/HeyMoa 화면에서 입력받아 암호화해 결제 대행사\(나이스정보통신 주식회사\)에 전달하며, HeyMoa는 이 값을 저장하지 않습니다/);
    expect(text("section-10")).toMatch(/첫 결제가 승인된 시각부터 한 달 단위이며, 다음 달 같은 날 같은 시각이 되기 전까지입니다/);
    expect(text("section-10")).toMatch(/법정대리인의 동의 없이 결제한 경우/);
    expect(text("section-11")).toMatch(/적용일 30일 전까지 서비스 안 공지 또는 이메일로 변경 전후 금액과 적용일을 알립니다/);
    expect(text("section-11")).toMatch(/결제자가 워크스페이스를 떠나거나/);
    expect(text("section-12")).toMatch(/결제나 환불을 처리하는 중에는 재개가 되지 않을 수 있으며/);
    expect(text("section-11")).toMatch(/결과를 확인하는 동안에는 Pro를 그대로 쓸 수 있습니다/);
    expect(text("section-13")).toMatch(/현재 이용 기간의 결제에 대한 환불 요청을 처리하기 시작하면 다음 자동 결제를 멈춥니다/);
    expect(text("section-13")).toMatch(/청약철회 등 이용자의 권리를 제한하지 않으며, 법령이 이용자에게 더 유리하면 법령을 따릅니다/);
    expect(text("section-13")).toMatch(/환불 요청을 받은 날부터 3영업일 이내에 결과를 알리고, 환불하는 경우 같은 기한 안에 결제 취소를 요청합니다/);
    expect(text("section-14")).toMatch(/구독 중인 워크스페이스를 삭제하면/);
    expect(text("section-2")).toMatch(/결제가 완료되거나 환불이 완료되면 결제자에게 이메일로 알립니다/);
    expect(text("section-2")).toMatch(/갱신 결제가 처음 승인되지 않으면 워크스페이스 관리자에게 서비스 안의 알림과 이메일로 한 번 알립니다/);
    expect(text("section-2")).toMatch(/결제자가 빠져 자동 결제가 멈추면 서비스 안의 알림으로 알립니다/);
    expect(text("section-11")).toMatch(/기한 전에 등록된 카드로 같은 결제를 자동으로 다시 시도할 수 있습니다/);
    expect(text("section-11")).not.toMatch(/같은 결제를 다시 시도하지 않고/);
    expect(document.body.textContent).not.toMatch(/페이플|Payple|토스/);
  });

  it("처리방침에 결제 정보 항목·목적·보관 기간과 결제 대행사 위탁(국내 처리)을 적는다", async () => {
    await renderPage(PrivacyPage, "ko");
    expect(document.getElementById("section-1")).toHaveTextContent(
      /헤이모아\(이하 'HeyMoa'\)는 서비스를 제공하는 데 필요한 정보만 처리합니다/,
    );
    expect(document.getElementById("section-1")).toHaveTextContent(/빌링키.*카드 번호 끝 네 자리.*HeyMoa 화면에서 입력받아 암호화해 결제 대행사\(나이스정보통신 주식회사\)에 전달하며 HeyMoa는 저장하지 않음/);
    expect(document.getElementById("section-2")).toHaveTextContent(/정기 결제 갱신, 환불 처리, 결제 문의 대응/);
    expect(document.getElementById("section-2")).toHaveTextContent(/결제가 완료되거나 환불이 완료되면 결제자에게 메일을 보냅니다/);
    const retention = document.getElementById("section-6");
    expect(retention).toHaveTextContent(/계약 또는 청약철회 기록\s*5년/);
    expect(retention).toHaveTextContent(/대금 결제 및 서비스 공급 기록.*5년/);
    expect(retention).toHaveTextContent(/소비자 불만 또는 분쟁 처리 기록\s*3년/);
    const entrust = document.getElementById("section-7");
    expect(entrust).toHaveTextContent(/나이스정보통신\(나이스페이\)\s*카드 정기결제 처리\s*해당 없음\(국내\)/);
    expect(entrust).toHaveTextContent(/나이스정보통신 주식회사 \(나이스페이\).*대한민국\. 국외 이전 아님.*카드 비밀번호 앞 2자리, 주문 번호, 결제 금액, 상품 이름/);
  });

  it("주소에 조항 앵커가 있으면 본문이 그려진 뒤 그 조항으로 맞춘다", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#section-13";
    try {
      await renderPage(TermsPage, "ko");
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("section-13"));
    } finally {
      window.location.hash = "";
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    }
  });

  it.each([
    [TermsPage, "Terms of Service", 15, "/terms"],
    [PrivacyPage, "Privacy Policy", 12, "/privacy"],
  ] as const)(
    "영어판(%#)은 한글 없이 같은 조 번호·앵커로 서고 맨 위에 한국어본 우선 고지가 있다",
    async (Page, title, count, path) => {
      const { container } = await renderPage(Page, "en");

      expect(screen.getByRole("heading", { name: title, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/the Korean version prevails/)).toBeVisible();
      expect(screen.getByRole("link", { name: "Read the Korean version" })).toHaveAttribute(
        "href",
        path
      );
      expect(screen.getByText("October 22, 2026")).toBeVisible();
      const sections = container.querySelectorAll('article > section[id^="section-"]');
      expect(sections).toHaveLength(count);
      sections.forEach((section, index) => {
        expect(section.id).toBe(`section-${index + 1}`);
        expect(section.querySelector("h2")?.textContent).toMatch(new RegExp(`^${index + 1}\\. `));
      });
      expect(container.textContent).not.toMatch(HANGUL);
      expect(document.body.innerHTML).not.toMatch(HANGUL);
      expect(container.textContent).not.toMatch(/\{email\}/);
    }
  );
});

describe("처리방침·약관 변경 관리", () => {
  afterEach(cleanup);

  it.each([
    [PrivacyPage, "/privacy", ["2026-11-03", "2026-10-23", "2026-10-22", "2026-10-18", "2026-10-12", "2026-09-04", "2026-07-17"]],
    [TermsPage, "/terms", ["2026-10-23", "2026-10-22", "2026-10-18", "2026-09-04", "2026-07-17"]],
  ] as const)("이전 판 목록이 판마다 고정 주소로 선다(%#)", async (Page, path, versions) => {
    await renderPage(Page, "ko");

    const list = screen.getByRole("navigation", { name: "이전 버전" });
    expect(
      [...list.querySelectorAll("a")].map((link) => link.getAttribute("href"))
    ).toEqual(versions.map((version) => `${path}/${version}`));
    expect(list).toHaveTextContent("2026년 10월 18일 ~ 2026년 10월 21일");
    expect(document.body.textContent).not.toMatch(/요청하면 (열람|확인할 수)/);
  });

  it.each([PrivacyPage, TermsPage])("AI 학습에 쓰지 않는다고 처리방침·약관 양쪽에 적는다(%#)", async (Page) => {
    await renderPage(Page, "ko");
    expect(document.body.textContent).toMatch(/AI 모델 학습에 쓰지 않습니다/);
  });

  it("이전 판 주소는 그 판의 원문과 적용 기간을 보여 준다", async () => {
    route.locale = "ko";
    render(await ArchivedPrivacyPage({ params: Promise.resolve({ version: "2026-10-18" }) }));

    expect(screen.getByRole("heading", { name: "개인정보 처리방침", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/2026년 10월 18일 ~ 2026년 10월 21일에 적용된 이전 버전입니다/)).toBeVisible();
    expect(screen.getByRole("link", { name: "현재 버전 보기" })).toHaveAttribute("href", "/privacy");
    expect(document.getElementById("section-5")).toHaveTextContent("5. 쿠키와 접속 분석");
    expect(document.body.textContent).not.toMatch(/\{email\}/);
  });

  it("이전 판은 한국어 주소만 연다", async () => {
    expect(privacyVersions()).toContainEqual({ version: "2026-07-17" });
    route.locale = "en";
    await expect(
      ArchivedPrivacyPage({ params: Promise.resolve({ version: "2026-10-18" }) })
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});

describe("약관·개인정보 공유 카드", () => {
  it.each([
    ["ko", "terms", termsMetadata, "/terms", "이용약관 | HeyMoa(헤이모아)"],
    ["en", "terms", termsMetadata, "/en/terms", "Terms of Service | HeyMoa"],
    ["ko", "privacy", privacyMetadata, "/privacy", "개인정보 처리방침 | HeyMoa(헤이모아)"],
    ["en", "privacy", privacyMetadata, "/en/privacy", "Privacy Policy | HeyMoa"],
  ] as const)("%s %s: og:url·제목이 그 페이지 것이다", async (locale, _name, generate, url, title) => {
    route.locale = locale;
    const meta = await generate();

    expect(meta.openGraph).toMatchObject({ url, title });
    expect(meta.twitter).toMatchObject({ title });
    expect(meta.alternates?.canonical).toBe(url);
  });
});
