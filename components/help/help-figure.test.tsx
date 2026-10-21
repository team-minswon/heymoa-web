import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HelpFigure } from "@/components/help/help-figure";
import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { intlWrapper } from "@/components/help/test-intl";

/** 가이드 컴포넌트는 언어 파일을 읽는다 — 실제 마케팅 루트처럼 한국어 언어 파일을 내려 준다. */
const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: intlWrapper() });

const src = Object.keys(HELP_MEDIA).find(
  (key) => key.endsWith(".webp") && !key.startsWith("clips/")
) as keyof typeof HELP_MEDIA & `${string}.webp`;

describe("HelpFigure 확대", () => {
  afterEach(cleanup);

  // 예전 확대 창은 `w-auto` 라 안의 `w-full` 이미지와 서로를 기다려 본문(694px)보다 작게(488px) 열렸다.
  // 실제 폭은 e2e 가 잰다(jsdom 은 `min()` 폭을 안 읽는다) — 여기서는 이미지가 확대 창 폭을 꽉 채우고 캡션이 같이 뜨는지만 본다.
  it("확대 창의 이미지는 폭을 꽉 채우고 캡션이 함께 뜬다", async () => {
    render(<HelpFigure src={src} alt="설명" caption="캡션" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 — 크게 보기" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")!.className).toContain("w-full");
    expect(dialog.textContent).toContain("캡션");
  });
});
