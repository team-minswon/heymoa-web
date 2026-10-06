import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
  });
});
