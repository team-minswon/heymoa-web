"use client";

import type { RelationWeb as RelationWebLayout } from "@/lib/notes/meeting-review/relation-web";
import { cn } from "@/lib/utils";

/**
 * 선택 항목의 1-hop 연결 뷰. **그래프 캔버스가 아니다** — 좌표는 `lib/notes/meeting-review/
 * relation-web.ts` 가 계산하고 여기는 SVG 로 옮길 뿐이다. 간선에는 label · 방향 · 근거
 * 개수만 있다. `kind` 는 모른다.
 *
 * 근거 없는 간선은 점선, 오래된 간선은 흐리게, 기각된 관계는 아예 없다(배치가 뺀다).
 */
export function RelationWebView({
  layout,
  onSelectNode,
}: {
  layout: RelationWebLayout;
  onSelectNode: (itemId: string) => void;
}) {
  const nodeWidth = Math.min(180, layout.width * 0.26);
  const nodeHeight = 40;
  return (
    <svg
      role="img"
      aria-label="선택한 항목의 직접 연결"
      data-testid="relation-web"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="h-auto w-full text-[var(--el-ink)]"
    >
      <defs>
        <marker id="relation-web-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" className="fill-[var(--el-muted)]" />
        </marker>
      </defs>
      {layout.edges.map((edge) => {
        const from = layout.nodes.find((node) => node.id === edge.from)!;
        const to = layout.nodes.find((node) => node.id === edge.to)!;
        const x1 = from.x + (from.x < to.x ? nodeWidth / 2 : -nodeWidth / 2);
        const x2 = to.x + (from.x < to.x ? -nodeWidth / 2 : nodeWidth / 2);
        const midX = (x1 + x2) / 2;
        // 같은 끝점 사이의 간선은 lane 만큼 휘어 나간다. 이름도 그 곡선의 꼭지에 붙는다.
        const bend = edge.lane * 28;
        const midY = (from.y + to.y) / 2 + bend;
        return (
          <g key={edge.id} data-testid="relation-edge" data-judgement={edge.judgement} data-lane={edge.lane} className={cn(edge.stale && "opacity-50")}>
            <path
              d={`M${x1},${from.y} Q${midX},${midY + bend} ${x2},${to.y}`}
              fill="none"
              className="stroke-[var(--el-muted)]"
              strokeWidth={1.25}
              strokeDasharray={edge.citationCount === 0 ? "4 3" : undefined}
              markerEnd="url(#relation-web-arrow)"
            />
            <text
              x={midX}
              y={midY - 6}
              textAnchor="middle"
              className="fill-[var(--el-muted)] text-[10px]"
            >
              {edge.label}
              {edge.citationCount === 0 ? " · 근거 없음" : ` · 근거 ${edge.citationCount}`}
            </text>
          </g>
        );
      })}
      {layout.nodes.map((node) => {
        const itemId = node.id.startsWith("REVIEW:") ? node.id.slice("REVIEW:".length) : null;
        const x = node.x - nodeWidth / 2;
        const y = node.y - nodeHeight / 2;
        return (
          <g
            key={node.id}
            data-testid="relation-node"
            data-side={node.side}
            role={itemId ? "button" : undefined}
            tabIndex={itemId ? 0 : undefined}
            onClick={() => itemId && onSelectNode(itemId)}
            onKeyDown={(event) => {
              if (itemId && (event.key === "Enter" || event.key === " ")) onSelectNode(itemId);
            }}
            className={cn(itemId && "cursor-pointer", !node.reachable && "opacity-60")}
          >
            <rect
              x={x}
              y={y}
              width={nodeWidth}
              height={nodeHeight}
              rx={8}
              className={cn(
                "fill-[var(--el-surface-card)] stroke-[var(--el-hairline)]",
                node.side === "center" && "stroke-[var(--el-hairline-strong)]"
              )}
            />
            <text x={node.x} y={node.y + 4} textAnchor="middle" className="fill-current text-[11px]">
              {truncate(node.label, nodeWidth)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(text: string, width: number) {
  const max = Math.max(6, Math.floor(width / 11));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
