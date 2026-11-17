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

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: intlWrapper() });

const src = Object.keys(HELP_MEDIA).find(
  (key) => key.endsWith(".webp") && !key.startsWith("clips/")
) as keyof typeof HELP_MEDIA & `${string}.webp`;

describe("HelpFigure 확대", () => {
  afterEach(cleanup);

  it("확대 창의 이미지는 폭을 꽉 채우고 캡션이 함께 뜬다", async () => {
    render(<HelpFigure src={src} alt="설명" caption="캡션" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 — 크게 보기" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")!.className).toContain("w-full");
    expect(dialog.textContent).toContain("캡션");
  });
});
