import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// v5 SPEC(FORM·ELEVATION)의 고도·형태·타이포 스케일이 코드 토큰으로 존재하는지 지킨다.
// 누가 토큰을 지우거나 e2/e3를 단일 티어로 되돌리면 여기서 깨진다. (APP-153)
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("design tokens (globals.css)", () => {
  const required = [
    "--shadow-e2",
    "--shadow-e3",
    "--radius-panel",
    "--radius-block",
    "--radius-control",
    "--radius-chip",
    "--text-screen-title",
    "--text-note-title",
    "--text-section",
    "--text-panel-title",
    "--text-read",
  ];

  it.each(required)("defines %s", (token) => {
    expect(css).toContain(token);
  });

  // 제품 면 오버레이는 스케일(panel/block/control/chip)만 쓴다. Tailwind 기본 ramp를
  // 쓰면 값이 스케일 밖으로 새는데(rounded-xl = 22.4), 특히 다이얼로그 footer는
  // `-mx-4 -mb-4`로 패널 밖까지 번져 **패널의 아래 모서리를 자기 radius로 덮는다.**
  // 그래서 위는 16, 아래는 22.4인 다이얼로그가 나왔다 (APP-241).
  //
  // `ui/card.tsx`는 뺀다 — 마케팅 면 전용이라 제품 스케일 대상이 아니다.
  it.each(["components/ui/dialog.tsx", "components/ui/alert-dialog.tsx"])(
    "%s uses the radius scale, not Tailwind's default ramp",
    (path) => {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source).not.toMatch(/rounded(-[trbl]{1,2})?-(sm|md|lg|xl|2xl|3xl)\b/);
    }
  );

  /**
   * 상태색은 **10% 틴트 배경 + `*-strong` 글자**의 짝으로만 쓴다. 배경과 글자에 같은 값을
   * 쓰면 틴트가 배경을 거의 흰색으로 남겨서 AA(4.5:1)에 못 미친다 — success는 2.96:1,
   * error는 4.13:1이었다. 여기서 실제 명암비를 계산해 못 박는다.
   */
  describe("상태색 틴트 대비", () => {
    const tokenValue = (name: string) =>
      css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

    const channels = (hex: string) =>
      [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const linear = (value: number) => {
      const channel = value / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    /** 흰 패널 위 10% 틴트가 실제로 그려지는 색. */
    const tintOnWhite = (rgb: number[]) =>
      rgb.map((channel) => channel * 0.1 + 255 * 0.9);
    const contrast = (fg: number[], bg: number[]) => {
      const [brighter, darker] = [luminance(fg), luminance(bg)].sort(
        (a, b) => b - a
      );
      return (brighter + 0.05) / (darker + 0.05);
    };

    it.each([
      ["--el-success", "--el-success-strong"],
      ["--el-error", "--el-error-strong"],
    ])("%s 틴트 위의 %s 글자가 AA를 넘는다", (tintToken, textToken) => {
      const tint = tokenValue(tintToken);
      const text = tokenValue(textToken);
      expect(tint, `${tintToken} missing`).toBeDefined();
      expect(text, `${textToken} missing`).toBeDefined();

      const ratio = contrast(
        channels(text!),
        tintOnWhite(channels(tint!))
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("keeps e2/e3 elevation as a two-shadow stack (not the marketing single tier)", () => {
    for (const token of ["--shadow-e2", "--shadow-e3"]) {
      // prettier가 값을 여러 줄로 나눌 수 있으므로 선언 전체(토큰~세미콜론)에서 센다.
      const start = css.indexOf(`${token}:`);
      expect(start, `${token} missing`).toBeGreaterThanOrEqual(0);
      const declaration = css.slice(start, css.indexOf(";", start));
      // 접지 + 앰비언트 2연타 → 콤마로 두 그림자.
      expect(declaration.split(",").length).toBeGreaterThanOrEqual(2);
    }
  });
});
