export type Point = { x: number; y: number };

export type LayoutNode = {
  id: string;
  /** 주제 순번. 주제 밖 항목은 `null` 이다 */
  group: number | null;
};

export type LayoutEdge = { source: string; target: string; weight?: number };

export type GraphLayout = {
  positions: Map<string, Point>;
  /** 주제마다 항목들의 무게중심. 주제 이름을 붙일 자리다 */
  anchors: Map<number, Point>;
};

/** 시뮬레이션의 이상 거리. 캔버스와 무관한 단위라 마지막에 캔버스에 맞춰 늘이고 줄인다 */
const K = 30;

/**
 * 힘 기반 배치. 같은 주제는 서로 덜 밀어내고 제 자리로 당겨져 한 덩이로 뭉치고, 주제 밖 항목은
 * 바깥 고리에 뜬다. 씨앗을 항목 ID에서 만들어 같은 검토본은 열 때마다 같은 모양이다 — 다시 열었는데
 * 뭉치가 옮겨 가 있으면 방금 본 자리를 다시 찾아야 한다.
 *
 * 도는 동안에는 캔버스 가장자리에 가두지 않는다. 가두면 밀려난 점이 테두리에 한 줄로 쌓인다.
 * 다 돈 뒤 전체 모양을 한 배율로 캔버스 가운데에 맞춘다.
 */
export function layoutGraph({
  nodes,
  edges,
  width,
  height,
  padding = 28,
  iterations = 300,
}: {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  padding?: number;
  iterations?: number;
}): GraphLayout {
  const positions = new Map<string, Point>();
  const anchors = new Map<number, Point>();
  const count = nodes.length;
  if (count === 0) return { positions, anchors };

  const random = seededRandom(nodes.map((node) => node.id).join("|"));
  const home = groupHomes(nodes, width, height);

  const index = new Map(nodes.map((node, at) => [node.id, at]));
  const px = new Float64Array(count);
  const py = new Float64Array(count);
  const homeX = new Float64Array(count);
  const homeY = new Float64Array(count);
  let looseAt = 0;
  const looseCount = nodes.filter((node) => node.group === null).length;
  nodes.forEach((node, at) => {
    if (node.group === null) {
      // 고리 위에 고르게 나눠 앉히고 조금만 흔든다. 무작위 각도는 한쪽에 몰린다.
      const angle = ((looseAt + random() * 0.5) / Math.max(looseCount, 1)) * Math.PI * 2;
      looseAt += 1;
      homeX[at] = home.center.x + Math.cos(angle) * home.ring.rx;
      homeY[at] = home.center.y + Math.sin(angle) * home.ring.ry;
    } else {
      const spot = home.groups.get(node.group)!;
      homeX[at] = spot.x;
      homeY[at] = spot.y;
    }
    px[at] = homeX[at] + (random() - 0.5) * K * 2;
    py[at] = homeY[at] + (random() - 0.5) * K * 2;
  });

  const links = edges.flatMap((edge) => {
    const a = index.get(edge.source);
    const b = index.get(edge.target);
    return a === undefined || b === undefined || a === b
      ? []
      : [{ a, b, weight: edge.weight ?? 1 }];
  });

  const moveX = new Float64Array(count);
  const moveY = new Float64Array(count);
  let temperature = K * 2;
  const cooling = (temperature - 0.3) / iterations;
  const cutoff = K * 4;

  for (let step = 0; step < iterations; step += 1) {
    moveX.fill(0);
    moveY.fill(0);

    // ponytail: 매 단계 모든 쌍을 본다(O(n²)). 항목 100여 개면 몇 ms 이고, 천 개를 넘기면 쿼드트리(Barnes–Hut)로 바꾼다.
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const dx = px[i] - px[j];
        const dy = py[i] - py[j];
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const sameTopic = nodes[i].group !== null && nodes[i].group === nodes[j].group;
        // 멀리 떨어진 다른 주제끼리는 밀지 않는다. 밀면 뭉치들이 끝없이 벌어져 가운데가 빈다.
        if (!sameTopic && distance > cutoff) continue;
        const force = ((K * K) / distance) * (sameTopic ? 0.8 : 1);
        moveX[i] += (dx / distance) * force;
        moveY[i] += (dy / distance) * force;
        moveX[j] -= (dx / distance) * force;
        moveY[j] -= (dy / distance) * force;
      }
    }

    for (const { a, b, weight } of links) {
      const dx = px[a] - px[b];
      const dy = py[a] - py[b];
      const distance = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = (weight * distance * distance) / K;
      moveX[a] -= (dx / distance) * force;
      moveY[a] -= (dy / distance) * force;
      moveX[b] += (dx / distance) * force;
      moveY[b] += (dy / distance) * force;
    }

    for (let i = 0; i < count; i += 1) {
      const pull = nodes[i].group === null ? 0.04 : 0.07;
      moveX[i] += (homeX[i] - px[i]) * pull * K;
      moveY[i] += (homeY[i] - py[i]) * pull * K;
      const length = Math.sqrt(moveX[i] * moveX[i] + moveY[i] * moveY[i]);
      if (length > 0) {
        const scale = Math.min(length, temperature) / length;
        px[i] += moveX[i] * scale;
        py[i] += moveY[i] * scale;
      }
    }

    temperature = Math.max(temperature - cooling, 0.3);
  }

  // 전체 모양을 한 배율로 캔버스 가운데에 맞춘다. 가로세로를 따로 늘이면 뭉치가 찌그러진다.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i += 1) {
    minX = Math.min(minX, px[i]);
    maxX = Math.max(maxX, px[i]);
    minY = Math.min(minY, py[i]);
    maxY = Math.max(maxY, py[i]);
  }
  // 한 축의 좌표가 모두 같으면(점 하나 · 한 줄로 늘어선 점) 그 축은 늘일 것이 없으니 가운데에 둔다.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const fit = Math.min(
    spanX > 0 ? (width - padding * 2) / spanX : Infinity,
    spanY > 0 ? (height - padding * 2) / spanY : Infinity
  );
  const scale = Number.isFinite(fit) ? fit : 1;
  const offsetX = spanX > 0 ? (width - spanX * scale) / 2 - minX * scale : width / 2 - minX * scale;
  const offsetY = spanY > 0 ? (height - spanY * scale) / 2 - minY * scale : height / 2 - minY * scale;

  const sums = new Map<number, { x: number; y: number; n: number }>();
  nodes.forEach((node, at) => {
    const point = { x: px[at] * scale + offsetX, y: py[at] * scale + offsetY };
    positions.set(node.id, point);
    if (node.group === null) return;
    const sum = sums.get(node.group) ?? { x: 0, y: 0, n: 0 };
    sum.x += point.x;
    sum.y += point.y;
    sum.n += 1;
    sums.set(node.group, sum);
  });
  for (const [group, sum] of sums) {
    anchors.set(group, { x: sum.x / sum.n, y: sum.y / sum.n });
  }
  return { positions, anchors };
}

/**
 * 주제마다 앉을 자리. 격자로 나누되 칸은 가장 큰 뭉치가 들어갈 만큼 잡고, 격자 전체의 가로세로
 * 비율을 캔버스에 맞춘다. 그래야 맞춰 넣은 뒤 한쪽이 비지 않는다. 주제 밖 항목은 격자를 감싸는
 * 타원 위에 앉는다.
 */
function groupHomes(nodes: LayoutNode[], width: number, height: number) {
  const sizes = new Map<number, number>();
  for (const node of nodes) {
    if (node.group !== null) sizes.set(node.group, (sizes.get(node.group) ?? 0) + 1);
  }
  const groups = [...sizes.keys()].sort((a, b) => a - b);
  const aspect = width / height;
  const cols = Math.max(1, Math.ceil(Math.sqrt(groups.length * aspect)));
  const rows = Math.max(1, Math.ceil(groups.length / cols));
  const largest = Math.max(1, ...sizes.values());
  const base = 2 * K * 0.9 * Math.sqrt(largest) + K;
  let cellW = base * Math.max(1, (aspect * rows) / cols);
  let cellH = (cellW * cols) / (aspect * rows);
  if (cellH < base) {
    cellW *= base / cellH;
    cellH = base;
  }
  const groupSpots = new Map<number, Point>(
    groups.map((group, at) => {
      const row = Math.floor(at / cols);
      // 마지막 줄이 덜 찼으면 가운데로 모은다
      const inRow = row === rows - 1 ? groups.length - cols * (rows - 1) : cols;
      const col = at % cols;
      return [
        group,
        {
          x: (col + 0.5) * cellW + ((cols - inRow) * cellW) / 2,
          y: (row + 0.5) * cellH,
        },
      ];
    })
  );
  const gridW = cols * cellW;
  const gridH = rows * cellH;
  return {
    groups: groupSpots,
    center: { x: gridW / 2, y: gridH / 2 },
    ring: { rx: gridW / 2 + K, ry: gridH / 2 + K },
  };
}

/** FNV-1a 로 씨앗을 만들고 mulberry32 로 푼다. 같은 문자열이면 같은 수열이다. */
function seededRandom(key: string) {
  let seed = 2166136261;
  for (let at = 0; at < key.length; at += 1) {
    seed ^= key.charCodeAt(at);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
