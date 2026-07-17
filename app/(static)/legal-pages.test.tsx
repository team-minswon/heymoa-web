import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/(static)/privacy/page";
import TermsPage from "@/app/(static)/terms/page";

describe("HeyMoa legal pages", () => {
  it("describes meeting transcription data on the privacy page", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: "개인정보 처리방침", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/실시간 음성 인식에는 ElevenLabs/)).toBeVisible();
    expect(screen.queryByText(/이미지 검사|진짜그림/)).not.toBeInTheDocument();
  });

  it("sets responsible recording expectations in the terms", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { name: "이용약관", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/참석자 고지와 동의/)).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "이용약관 목차" })
    ).toBeInTheDocument();
  });
});
