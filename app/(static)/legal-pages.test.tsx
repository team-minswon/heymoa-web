import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DesktopHelpPage from "@/app/(static)/help/desktop/page";
import HelpPage from "@/app/(static)/help/page";
import PrivacyPage from "@/app/(static)/privacy/page";
import TermsPage from "@/app/(static)/terms/page";

describe("HeyMoa legal pages", () => {
  // 언마운트하지 않으면 React scheduler가 setImmediate로 잡아 둔 작업이 jsdom 환경이
  // 헐린 뒤에 돌아 "window is not defined"로 죽는다. 테스트는 전부 통과하는데 exit code만
  // 1이 되어, 머지 게이트에서 내 변경이 깬 줄 알고 시간을 쓴다 (APP-238).
  afterEach(cleanup);

  it("describes meeting transcription data on the privacy page", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: "개인정보 처리방침", level: 1 })
    ).toBeInTheDocument();
    // 실제로 쓰는 사업자를 적었는지 본다. 예전에는 안 쓰는 이름(ElevenLabs)이 적혀 있었다.
    expect(screen.getByText(/실시간 음성 인식은 Soniox/)).toBeVisible();
    expect(screen.getByText(/화자 분리는 pyannote\.ai/)).toBeVisible();
    expect(screen.getByText(/국외에서 처리합니다/)).toBeVisible();
    expect(screen.queryByText(/ElevenLabs/)).not.toBeInTheDocument();
    expect(screen.queryByText(/이미지 검사|진짜그림/)).not.toBeInTheDocument();
    // PostHog 키와 함께 들어간 문안이다(APP-1068). 채우지 않은 자리표시가 운영에 나가면 안 된다.
    expect(screen.getByText(/이전받는 자는 PostHog Inc\./)).toBeVisible();
    expect(document.body.textContent).not.toMatch(/【/);
  });

  it("sets responsible recording expectations in the terms", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { name: "이용약관", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/참석자 고지와 동의/)).toBeVisible();
    // 좁은 화면의 접는 목차(`<details>`)와 넓은 화면의 sticky 목차가 같은 목록을 따로 그린다. 브라우저에서는
    // 늘 한쪽이 display:none 이지만 jsdom 은 Tailwind CSS 를 모르니 둘 다 보인다.
    expect(
      screen.getAllByRole("navigation", { name: "이용약관 목차" })
    ).toHaveLength(2);
    // 도움말이 같은 틀을 쓰면서 문구를 바꿀 수 있게 됐다 — 약관은 기본값 그대로다
    expect(screen.getByText("시행일", { exact: false })).toBeVisible();
  });

  // 제품 화면이 `/help#id`로 그 항목에 바로 온다(APP-1024). id를 바꾸면 그 링크가 소리 없이 깨진다.
  it("keeps the help anchors that product screens link to", () => {
    const { container } = render(<HelpPage />);

    expect(
      screen.getByRole("heading", { name: "HeyMoa 사용법", level: 1 })
    ).toBeInTheDocument();
    for (const id of [
      "start",
      "recording",
      "desktop",
      "speakers",
      "summary",
      "tasks",
      "integrations",
      "agents",
      "trouble",
    ]) {
      expect(container.querySelector(`section#${id}`), id).not.toBeNull();
      expect(
        container.querySelector(`nav a[href="#${id}"]`),
        `목차 #${id}`
      ).not.toBeNull();
    }
    expect(screen.getByText("고친 날", { exact: false })).toBeVisible();
  });

  // 데스크톱 가이드는 도움말 「데스크톱 앱」 항목과 다운로드 페이지에서 온다(APP-1026)
  it("links the desktop guide from the help page", () => {
    const { container } = render(<HelpPage />);

    expect(
      container.querySelector('section#desktop a[href="/help/desktop"]')
    ).not.toBeNull();
    cleanup();

    render(<DesktopHelpPage />);
    expect(
      screen.getByRole("heading", { name: "데스크톱 앱 사용법", level: 1 })
    ).toBeInTheDocument();
  });
});
