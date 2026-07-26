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
