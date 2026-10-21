import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * 한국어 줄바꿈은 `app/globals.css` 의 body 한 곳(`word-break: keep-all`)이 맡는다. 컴포넌트마다 `break-keep` 을
 * 붙이던 때는 빠진 곳에서 「삭제/돼요」처럼 낱말이 갈렸다(PRO-66). 다시 붙이면 규칙이 두 벌이 된다.
 * 실제 화면에서 낱말이 안 갈리는지는 `e2e/i18n.spec.ts` 가 회의록 삭제 확인창으로 본다.
 */
describe("전역 줄바꿈", () => {
  it("body 가 낱말 단위 줄바꿈을 건다", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const base = css.slice(css.indexOf("@layer base"));
    expect(base).toMatch(
      /body\s*\{[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*break-word;/
    );
  });

  it("컴포넌트에 break-keep 클래스가 남지 않는다", () => {
    let hits = "";
    try {
      hits = execFileSync(
        "git",
        [
          "grep",
          "-n",
          "-I",
          "--untracked",
          "break-keep",
          "--",
          "*.ts",
          "*.tsx",
          ":!lib/line-break.test.ts",
        ],
        { encoding: "utf8" }
      );
    } catch {
      // 찾은 것이 없으면 git grep 은 1 로 끝난다.
    }
    expect(hits).toBe("");
  });
});
