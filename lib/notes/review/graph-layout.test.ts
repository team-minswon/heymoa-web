import { describe, expect, it } from "vitest";

import { layoutGraph, type LayoutEdge, type LayoutNode } from "@/lib/notes/review/graph-layout";

const WIDTH = 840;
const HEIGHT = 520;
const PADDING = 28;

/** 멘토링 회의 검토본과 같은 크기 — 주제 여덟(항목 수가 제각각)과 주제 밖 항목 열하나. */
function mentoringSized() {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  [13, 12, 10, 8, 9, 13, 6, 5].forEach((size, index) => {
    const group = index + 1;
    const center = `g${group}-0`;
    for (let at = 0; at < size; at += 1) {
      const id = `g${group}-${at}`;
      nodes.push({ id, group });
      if (at > 0) edges.push({ source: center, target: id });
      if (at > 2 && at % 3 === 0) edges.push({ source: `g${group}-1`, target: id });
    }
  });
  for (let at = 0; at < 11; at += 1) nodes.push({ id: `loose-${at}`, group: null });
  return { nodes, edges, width: WIDTH, height: HEIGHT, padding: PADDING };
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("layoutGraph", () => {
  it("같은 입력이면 같은 자리이고, 여백 안에 머문다", () => {
    const first = layoutGraph(mentoringSized());
    const second = layoutGraph(mentoringSized());
    expect([...first.positions]).toEqual([...second.positions]);
    for (const { x, y } of first.positions.values()) {
      expect(x).toBeGreaterThanOrEqual(PADDING - 1e-6);
      expect(x).toBeLessThanOrEqual(WIDTH - PADDING + 1e-6);
      expect(y).toBeGreaterThanOrEqual(PADDING - 1e-6);
      expect(y).toBeLessThanOrEqual(HEIGHT - PADDING + 1e-6);
    }
  });

  it("테두리에 줄지어 쌓이지 않는다", () => {
    const { positions } = layoutGraph(mentoringSized());
    const onEdge = [...positions.values()].filter(
      ({ x, y }) =>
        x <= PADDING + 2 || x >= WIDTH - PADDING - 2 || y <= PADDING + 2 || y >= HEIGHT - PADDING - 2
    );
    // 맞춰 넣으면 가장 바깥 점 몇 개는 여백선에 닿는다. 한 줄로 쌓인 것과 가른다.
    expect(onEdge.length / positions.size).toBeLessThanOrEqual(0.06);
  });

  it("주제마다 한 덩이로 뭉치고, 다른 주제의 중심보다 제 중심에 가깝다", () => {
    const input = mentoringSized();
    const { positions, anchors } = layoutGraph(input);
    let own = 0;
    let other = 0;
    let n = 0;
    const spreads = new Map<number, number[]>();
    for (const node of input.nodes) {
      if (node.group === null) continue;
      const at = positions.get(node.id)!;
      const toOwn = distance(at, anchors.get(node.group)!);
      own += toOwn;
      other += Math.min(
        ...[...anchors]
          .filter(([group]) => group !== node.group)
          .map(([, anchor]) => distance(at, anchor))
      );
      n += 1;
      spreads.set(node.group, [...(spreads.get(node.group) ?? []), toOwn]);
    }
    expect(own / n).toBeLessThan((other / n) * 0.5);
    for (const values of spreads.values()) {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      // 주제 하나의 평균 반경이 캔버스 짧은 변의 10% 안이다
      expect(mean).toBeLessThan(HEIGHT * 0.1);
    }
  });
});

describe("layoutGraph 한 점", () => {
  it("점이 하나뿐이면 가장자리로 쏠리지 않고 가운데에 선다", () => {
    const { positions } = layoutGraph({
      nodes: [{ id: "only", group: null }],
      edges: [],
      width: 840,
      height: 520,
    });
    expect(positions.get("only")).toEqual({ x: 420, y: 260 });
  });
});
