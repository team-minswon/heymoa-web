"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";

import { ROLE_COLOR } from "@/components/notes/review/role-dot";
import { screenRadius, type ForceLink, type ForceNode } from "@/lib/notes/review/graph-model";

export type GraphNodeObject = NodeObject<ForceNode>;
type GraphLinkObject = LinkObject<ForceNode, ForceLink>;
export type GraphApi = ForceGraphMethods<GraphNodeObject, GraphLinkObject>;

export type GraphTokens = {
  ink: string;
  muted: string;
  mutedSoft: string;
  card: string;
  canvas: string;
};

/** 이 배율부터 항목 이름을 늘 적는다 */
const LABEL_ZOOM = 2.4;

/** 배치가 돌면 링크 끝이 ID 문자열에서 점 객체로 바뀐다 */
const endId = (end: unknown) => String(typeof end === "object" && end !== null ? (end as { id: string }).id : end);

/** 토큰은 hex 다. 흐림은 투명도로만 준다 */
function withAlpha(color: string, alpha: number) {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return color;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

const clip = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);

/**
 * 판을 가운데로 끄는 약한 힘. 서로 이어지지 않은 주제 뭉치와 주제 밖 항목이 밀어냄에 밀려
 * 판 밖으로 흩어지지 않게 한다. d3 의 forceX/Y 와 같지만 그 패키지를 직접 들이지 않으려 여기 둔다.
 */
function gravity(strength: number) {
  let nodes: GraphNodeObject[] = [];
  return Object.assign(
    (alpha: number) => {
      for (const node of nodes) {
        node.vx = (node.vx ?? 0) - (node.x ?? 0) * strength * alpha;
        node.vy = (node.vy ?? 0) - (node.y ?? 0) * strength * alpha;
      }
    },
    { initialize: (next: GraphNodeObject[]) => void (nodes = next) }
  );
}

/** 점끼리 반지름 + 여백보다 가까우면 반씩 밀어낸다. d3 의 forceCollide 와 같은 일이다 */
function collide(padding: number) {
  let nodes: GraphNodeObject[] = [];
  return Object.assign(
    () => {
      // ponytail: 모든 쌍을 본다(O(n²)). 점 수백 개면 틱당 1ms 안쪽, 천 개를 넘으면 사분 트리로 바꾼다.
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const min = a.radius + b.radius + padding;
          const distance = Math.hypot(dx, dy) || 0.01;
          if (distance >= min) continue;
          const push = ((min - distance) / distance) * 0.5;
          a.x = (a.x ?? 0) - dx * push;
          a.y = (a.y ?? 0) - dy * push;
          b.x = (b.x ?? 0) + dx * push;
          b.y = (b.y ?? 0) + dy * push;
        }
      }
    },
    { initialize: (next: GraphNodeObject[]) => void (nodes = next) }
  );
}

/** 이 배율보다 멀리서는 작은 주제의 이름을 번호로만 적는다. 촘촘한 자리에서 이름끼리 겹친다 */
const TOPIC_NAME_ZOOM = 1.2;
/** 멀리서도 이름을 적는 큰 주제의 항목 수 */
const BIG_TOPIC = 10;

export default function ReviewGraphCanvas({
  data,
  width,
  height,
  tokens,
  labelLimit,
  zoomRange,
  hoveredId,
  lit,
  selectedId,
  graphRef,
  onHover,
  onSelect,
  onZoom,
  onSettled,
}: {
  data: { nodes: GraphNodeObject[]; links: GraphLinkObject[] };
  width: number;
  height: number;
  tokens: GraphTokens;
  /** 허브 이름을 몇 글자에서 자르나. 0 이면 번호만 */
  labelLimit: number;
  zoomRange: [number, number];
  hoveredId: string | null;
  lit: Set<string> | null;
  selectedId: string | null;
  graphRef: RefObject<GraphApi | undefined>;
  onHover: (node: GraphNodeObject | null) => void;
  onSelect: (node: GraphNodeObject) => void;
  onZoom: (scale: number) => void;
  onSettled: () => void;
}) {
  const fitted = useRef(false);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    fitted.current = false;
    // 허브는 크게 밀어내 주제끼리 떨어뜨리고, 항목은 덜 밀어 제 허브 곁에 모이게 한다.
    graph.d3Force("charge")?.strength((node: GraphNodeObject) => (node.hub ? -300 : -45)).distanceMax(400);
    graph
      .d3Force("link")
      ?.distance((link: GraphLinkObject) => (link.kind === "hub" ? 40 : link.kind === "relation" ? 45 : 90))
      .strength((link: GraphLinkObject) => (link.kind === "hub" ? 0.5 : link.kind === "relation" ? 0.2 : 0.02));
    graph.d3Force("gravity", gravity(0.04));
    graph.d3Force("collide", collide(2));
    graph.d3ReheatSimulation();
  }, [data, graphRef]);

  const dimmed = (id: string) => lit !== null && !lit.has(id);

  const drawNode = useCallback(
    (node: GraphNodeObject, ctx: CanvasRenderingContext2D, scale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = screenRadius(node.radius, node.hub, scale);
      ctx.globalAlpha = dimmed(node.id) ? 0.15 : 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      if (node.hub) {
        ctx.fillStyle = tokens.ink;
        ctx.fill();
      } else {
        const item = node.item!;
        // 안건은 속이 빈 원이다 — 결론이 아니라 이야기의 뿌리라 역할 색으로 칠하지 않는다.
        ctx.fillStyle = item.kind === "AGENDA" ? tokens.card : ROLE_COLOR[item.role];
        ctx.fill();
        if (item.kind === "AGENDA" || item.center) {
          ctx.strokeStyle = tokens.ink;
          ctx.lineWidth = 1.5 / scale;
          ctx.stroke();
        }
      }
      if (node.id === selectedId || node.id === hoveredId) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3 / scale, 0, 2 * Math.PI);
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = (node.id === selectedId ? 2 : 1.2) / scale;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dimmed 는 lit 만 읽는다
    [tokens, selectedId, hoveredId, lit]
  );

  // 이름은 모든 점 위에 한 번 더 그린다. 점과 같이 그리면 나중에 그린 점이 앞선 이름을 덮는다.
  // 이미 그린 이름이나 점과 겹치는 이름은 건너뛴다 — 허브, 불 켜진 이웃, 나머지 순으로 자리를 먼저 잡는다.
  const drawLabels = useCallback(
    (ctx: CanvasRenderingContext2D, scale: number) => {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      const taken: [number, number, number, number][] = [];
      const write = (
        node: GraphNodeObject,
        text: string,
        size: number,
        weight: number,
        color: string,
        force = false
      ) => {
        ctx.font = `${weight} ${size / scale}px Inter, system-ui, sans-serif`;
        const x = node.x ?? 0;
        const y = (node.y ?? 0) + screenRadius(node.radius, node.hub, scale) + 2 / scale;
        const half = ctx.measureText(text).width / 2;
        const box: [number, number, number, number] = [x - half, y, x + half, y + (size + 2) / scale];
        // ponytail: 이름끼리 전부 견준다(O(n²)). 이름 수백 개면 한 틀에 1ms 안쪽이다.
        const overlaps = taken.some(([l, t, r, b]) => box[0] < r && box[2] > l && box[1] < b && box[3] > t);
        if (overlaps && !force) return false;
        taken.push(box);
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = tokens.canvas;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        return true;
      };
      for (const node of data.nodes) {
        if (!node.hub) continue;
        ctx.globalAlpha = dimmed(node.id) ? 0.25 : 1;
        const [ordinal, ...rest] = node.label.split(" ");
        const title = scale >= TOPIC_NAME_ZOOM || node.degree >= BIG_TOPIC ? rest.join(" ") : "";
        const named = labelLimit > 0 && title ? `${ordinal} ${clip(title, labelLimit)}` : ordinal;
        if (!write(node, named, 11.5, 600, tokens.ink)) write(node, ordinal, 11.5, 600, tokens.ink, true);
      }
      ctx.globalAlpha = 1;
      if (scale < LABEL_ZOOM) return;
      const items = data.nodes.filter((node) => !node.hub && !dimmed(node.id));
      // 점도 자리를 차지한다. 남의 점을 덮는 이름은 적지 않는다
      for (const node of items) {
        const radius = screenRadius(node.radius, node.hub, scale);
        const [x, y] = [node.x ?? 0, node.y ?? 0];
        taken.push([x - radius, y - radius, x + radius, y + radius]);
      }
      if (lit) items.sort((a, b) => Number(lit.has(b.id)) - Number(lit.has(a.id)));
      for (const node of items) write(node, clip(node.label, 18), 10, 400, tokens.muted);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dimmed 는 lit 만 읽는다
    [data, tokens, labelLimit, lit]
  );

  const linkColor = useCallback(
    (link: GraphLinkObject) => {
      const adjacent = hoveredId !== null && (endId(link.source) === hoveredId || endId(link.target) === hoveredId);
      if (adjacent) return tokens.ink;
      const fade = hoveredId !== null ? 0.25 : 1;
      if (link.kind === "hub") return withAlpha(tokens.mutedSoft, 0.28 * fade);
      if (link.kind === "also") return withAlpha(tokens.mutedSoft, 0.7 * fade);
      return withAlpha(tokens.muted, 0.75 * fade);
    },
    [hoveredId, tokens]
  );

  const linkWidth = useCallback(
    (link: GraphLinkObject) => {
      const adjacent = hoveredId !== null && (endId(link.source) === hoveredId || endId(link.target) === hoveredId);
      return adjacent ? 1.6 : link.kind === "relation" ? 1.1 : link.kind === "also" ? 0.9 : 0.6;
    },
    [hoveredId]
  );

  return (
    <ForceGraph2D<ForceNode, ForceLink>
      ref={graphRef as React.MutableRefObject<GraphApi | undefined>}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      minZoom={zoomRange[0]}
      maxZoom={zoomRange[1]}
      warmupTicks={0}
      cooldownTicks={220}
      d3VelocityDecay={0.35}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={(node, color, ctx, scale) => {
        // 작은 점도 손가락으로 누를 수 있게 누를 자리는 화면에서 8px 반지름을 넘게 둔다.
        ctx.fillStyle = color;
        ctx.beginPath();
        const radius = screenRadius(node.radius, node.hub, scale);
        ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(radius + 2 / scale, 8 / scale), 0, 2 * Math.PI);
        ctx.fill();
      }}
      onRenderFramePost={drawLabels}
      linkColor={linkColor}
      linkWidth={linkWidth}
      linkLineDash={(link) => (link.kind === "also" ? [2, 3] : null)}
      onNodeHover={onHover}
      onNodeClick={onSelect}
      // 그냥 굴리면 페이지가 내려가야 한다. 휠 확대는 Ctrl/⌘ 과 트랙패드 핀치(ctrlKey 가 실린다)만이다.
      enableZoomInteraction={(event) => event.ctrlKey || event.metaKey}
      onZoom={({ k }) => onZoom(k)}
      onEngineStop={() => {
        if (fitted.current) return;
        fitted.current = true;
        graphRef.current?.zoomToFit(400, 24);
        onSettled();
      }}
    />
  );
}
