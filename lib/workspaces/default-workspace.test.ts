import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CHANGE_DEFAULT_MUTATION_KEY } from "@/lib/workspaces/default-workspace";

describe("default workspace mutation key", () => {
  it("matches the key orval actually generates", () => {
    // 이 키로 전역 진행 상태를 읽어 두 호출부(내 계정 목록·워크스페이스 설정 카드)를
    // 함께 잠근다. orval이 키를 바꾸면 잠금이 조용히 아무것도 안 하게 되므로 대조한다.
    const generated = readFileSync(
      "lib/api/generated/workspaces/workspaces.ts",
      "utf8"
    );

    expect(generated).toContain(
      `const mutationKey = ${JSON.stringify(CHANGE_DEFAULT_MUTATION_KEY)}`
    );
  });
});
