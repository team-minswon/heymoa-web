import { describe, expect, it } from "vitest";

import { parseLocalProjects } from "@/lib/mocks/local-projects";

const good = { projectId: "p1", name: "프로젝트", links: { notes: [] } };

describe("parseLocalProjects", () => {
  it("모양이 틀린 항목은 건너뛰고 맞는 항목만 남긴다", () => {
    expect(parseLocalProjects([{}, null, 3, { projectId: "x", name: "n" }, good])).toEqual([good]);
  });
  it("배열이 아니거나 하나도 안 맞으면 빈 목록이다", () => {
    expect(parseLocalProjects({})).toEqual([]);
    expect(parseLocalProjects([{}])).toEqual([]);
  });
});
