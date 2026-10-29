import { describe, expect, it } from "vitest";

import { GRID_COMPACT, GRID_ROOMY, PILL_GAP, PILL_H, laneGeom, stopMetrics } from "@/components/projects/agenda-ribbon-column";

// 읽기 쉬운 크기: 점 지름 12px 이상, 캡슐 높이 20px 이상(테두리 포함)
describe("stopMetrics", () => {
  it.each([1, 2, 3, 4, 12, 150])("keeps a dot or capsule of %i agendas at the readable size on main and branch routes", (count) => {
    for (const small of [false, true]) {
      for (const col of [22, 40, 148, 400]) {
        const { outer, half, stroke } = stopMetrics(count, small, col);
        if (count === 1) expect(outer).toBeGreaterThanOrEqual(12);
        else expect(outer).toBeGreaterThanOrEqual(20);
        expect(half * 2 + stroke).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("widens a capsule for a longer number", () => {
    expect(stopMetrics(10, false, 148).w).toBeGreaterThan(stopMetrics(2, false, 148).w);
  });
});

// 접힌 안건 표식이 있는 줄기는 표식만큼 줄이 길고, 없으면 틀 그대로
describe("laneGeom", () => {
  it.each([GRID_COMPACT, GRID_ROOMY])("keeps the frame for a lane without fold marks", (grid) => {
    expect(laneGeom(grid, null)).toEqual({ t: grid.T, P: grid.P, PT: grid.PT });
  });

  it.each([GRID_COMPACT, GRID_ROOMY])("leaves 8px under the pill row before the branch road and the next lane label", (grid) => {
    const { t, P, PT } = laneGeom(grid, "pill");
    const pillBottom = grid.Y + 12 + PILL_GAP + PILL_H;
    // 갈래 길 위에 앉는 가장 큰 것(캡슐 12·제목 줄 ROW/2)의 위쪽 끝과 알약 바닥 사이
    expect(t - Math.max(12, grid.ROW / 2) - pillBottom).toBeGreaterThanOrEqual(PILL_GAP);
    // 다음 줄 이름표(맨 위에서 NAME 만큼 내려옴)와 알약 바닥 사이
    expect(P + grid.NAME - pillBottom).toBeGreaterThanOrEqual(PILL_GAP);
    expect(t).toBeGreaterThanOrEqual(grid.T);
    expect(PT - t).toBeGreaterThanOrEqual(grid.PT - grid.T);
  });

  it("grows only the branch road for the hook of a narrow board, by a few px", () => {
    const { t, P, PT } = laneGeom(GRID_COMPACT, "hook");
    expect(t - GRID_COMPACT.T).toBeLessThanOrEqual(4);
    expect(P).toBe(GRID_COMPACT.P);
    expect(PT).toBe(Math.max(GRID_COMPACT.PT, t + GRID_COMPACT.PT - GRID_COMPACT.T));
  });
});
