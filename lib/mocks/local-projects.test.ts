import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadLocalProjects,
  parseLocalProjects,
} from "@/lib/mocks/local-projects";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const good = { projectId: "p1", name: "프로젝트", links: { notes: [] } };

it("고정 시드 검사에서는 로컬 팀 자료를 요청하지 않습니다", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("NEXT_PUBLIC_MOCK_LOCAL_PROJECTS", "disabled");
  await loadLocalProjects();
  expect(fetch).not.toHaveBeenCalled();
});

it("일반 목 모드에서는 로컬 자료가 없어도 기본 시드를 유지합니다", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("NEXT_PUBLIC_MOCK_LOCAL_PROJECTS", "");
  await expect(loadLocalProjects()).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith("/mock-local/projects.json", {
    cache: "no-store",
  });
});

describe("parseLocalProjects", () => {
  it("모양이 틀린 항목은 건너뛰고 맞는 항목만 남긴다", () => {
    expect(
      parseLocalProjects([{}, null, 3, { projectId: "x", name: "n" }, good])
    ).toEqual([good]);
  });
  it("배열이 아니거나 하나도 안 맞으면 빈 목록이다", () => {
    expect(parseLocalProjects({})).toEqual([]);
    expect(parseLocalProjects([{}])).toEqual([]);
  });
});
