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

// 페이지가 주소의 언어(root param)를 읽는다. vitest 에는 Next 라우팅이 없어 언어를 직접 준다.
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
  // 언마운트하지 않으면 React scheduler가 setImmediate로 잡아 둔 작업이 jsdom 환경이
  // 헐린 뒤에 돌아 "window is not defined"로 죽는다. 테스트는 전부 통과하는데 exit code만
  // 1이 되어, 머지 게이트에서 내 변경이 깬 줄 알고 시간을 쓴다 (APP-238).
  afterEach(cleanup);

  it("describes meeting transcription data on the privacy page", async () => {
    await renderPage(PrivacyPage, "ko");

    expect(
      screen.getByRole("heading", { name: "개인정보 처리방침", level: 1 })
    ).toBeInTheDocument();
    // 실제로 쓰는 사업자를 적었는지 본다. 예전에는 안 쓰는 이름(ElevenLabs)이 적혀 있었다.
    expect(screen.getByRole("heading", { name: /Soniox Inc\.\s*실시간 음성 인식/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /pyannote\.ai\)\s*화자 구분/ })).toBeVisible();
    // OpenRouter 뒤의 모델 사업자는 재위탁으로 적는다(APP-1385). TypeSafe 가 빠져 있었다.
    expect(screen.getByRole("heading", { name: /TypeSafe AI, Inc\.\s*AI 모델\(OpenRouter 재위탁\)/ })).toBeVisible();
    expect(screen.queryByText(/ElevenLabs/)).not.toBeInTheDocument();
    expect(screen.queryByText(/이미지 검사|진짜그림/)).not.toBeInTheDocument();
    // PostHog 키와 함께 들어간 문안이다(APP-1068). 채우지 않은 자리표시가 운영에 나가면 안 된다.
    expect(screen.getByText(/PostHog Inc\./)).toBeVisible();
    // 「확인 중」 자리표시는 개정에서 걷어냈다(APP-1196). 다시 들어오면 미완성 문안이 운영에 나간다.
    expect(document.body.textContent).not.toMatch(/확인 중/);
    // 계정 설정의 「처리방침」 링크가 `/privacy#section-5`로 온다. 조 순서가 밀리면 다른 조가 열린다.
    expect(document.getElementById("section-5")).toHaveTextContent("제5조 (자동 수집 장치와 거부 방법)");
    // 서버 사건은 브라우저의 「이용 통계 보내기」와 별개라는 것을 적어 둔다(APP-1071)
    expect(screen.getByText(/서버에서 처리된 기록은/)).toBeVisible();
    // 운영 알림으로 나가는 이용자 이름은 Grafana Cloud·Slack 카드에 적는다(APP-1217)
    expect(document.body.textContent).toMatch(/운영 알림에 쓰는 이용자 이름/);
    expect(document.body.textContent).toMatch(/운영자 알림/);
    // 보관 기간은 숫자로 적는다(APP-1385). 「필요한 기간 동안」으로 비워 두면 문의에 답할 근거가 없었다.
    expect(document.getElementById("section-6")).toHaveTextContent(/늦어도 저장한 날부터 30일/);
    expect(document.getElementById("section-6")).toHaveTextContent(/나가거나 탈퇴해도 그 워크스페이스의 지난 회의 기록에는 이름이 남습니다/);
    expect(document.getElementById("section-1")).toHaveTextContent("서비스 이용 기록");
    expect(document.body.textContent).not.toMatch(/【/);
    // 문의 주소 자리표시(`{email}`)가 채워진다.
    expect(document.body.textContent).toContain("team.minswon@gmail.com로 보내 주시기 바랍니다.");
    expect(document.body.textContent).not.toMatch(/\{email\}/);
    // 보호책임자·확인 못 한 사업자 칸 같은 자리표시(`{…}`)가 남아 운영에 나가면 안 된다(APP-1385).
    expect(document.querySelector("article")?.textContent).not.toMatch(/[{}]/);
    expect(document.getElementById("section-10")).toHaveTextContent("김민수");
  });

  it("sets responsible recording expectations in the terms", async () => {
    await renderPage(TermsPage, "ko");

    expect(
      screen.getByRole("heading", { name: "이용약관", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/참석자 고지와 동의/)).toBeVisible();
    // 좁은 화면의 접는 목차(`<details>`)와 넓은 화면의 sticky 목차가 같은 목록을 따로 그린다. 브라우저에서는
    // 늘 한쪽이 display:none 이지만 jsdom 은 Tailwind CSS 를 모르니 둘 다 보인다.
    expect(
      screen.getAllByRole("navigation", { name: "이용약관 목차" })
    ).toHaveLength(2);
    // 머리에 공고일·시행일이 있다. 이번 판은 날짜를 정하기 전이라 「미정」이다(`LEGAL_CURRENT`).
    expect(screen.getByText("공고일")).toBeVisible();
    expect(screen.getAllByText("미정")).toHaveLength(2);
    // 번역본 고지는 한국어본에 서지 않는다.
    expect(screen.queryByRole("link", { name: "한국어본 보기" })).not.toBeInTheDocument();
  });

  it.each([
    [TermsPage, "Terms of Service", 11, "/terms"],
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
      // 다른 화면이 링크하는 앵커(`#section-5` 등)가 언어와 상관없이 같은 조를 가리킨다.
      const sections = container.querySelectorAll("article > section");
      expect(sections).toHaveLength(count);
      sections.forEach((section, index) => {
        expect(section.id).toBe(`section-${index + 1}`);
        expect(section.querySelector("h2")?.textContent).toMatch(new RegExp(`^${index + 1}\\. `));
      });
      // JSON-LD(script)까지 포함해 한글이 남지 않는다.
      expect(container.textContent).not.toMatch(HANGUL);
      expect(document.body.innerHTML).not.toMatch(HANGUL);
      expect(container.textContent).not.toMatch(/\{email\}/);
    }
  );
});

describe("처리방침·약관 변경 관리(APP-1385)", () => {
  afterEach(cleanup);

  it.each([
    [PrivacyPage, "/privacy", ["2026-10-22", "2026-10-18", "2026-10-12", "2026-09-04", "2026-07-17"]],
    [TermsPage, "/terms", ["2026-10-22", "2026-10-18", "2026-09-04", "2026-07-17"]],
  ] as const)("이전 판 목록이 판마다 고정 주소로 선다(%#)", async (Page, path, versions) => {
    await renderPage(Page, "ko");

    const list = screen.getByRole("navigation", { name: "이전 버전" });
    expect(
      [...list.querySelectorAll("a")].map((link) => link.getAttribute("href"))
    ).toEqual(versions.map((version) => `${path}/${version}`));
    // 다음 판 시행 전날까지가 적용 기간이다.
    expect(list).toHaveTextContent("2026년 10월 18일 ~ 2026년 10월 21일");
    // 「요청하면 열람」 대신 목록으로 연다.
    expect(document.body.textContent).not.toMatch(/요청하면/);
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

// 공유 카드가 홈의 og:url·제목을 물려받으면 약관·방침 링크를 공유할 때 홈으로 묶인다(APP-1294).
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
