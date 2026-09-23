"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Minus, Plus, Scan } from "lucide-react";

import type {
  GraphApi,
  GraphNodeObject,
  GraphTokens,
} from "@/components/notes/review/review-graph-canvas";
import { RoleDot } from "@/components/notes/review/role-dot";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";
import {
  buildReviewGraph,
  GRAPH_ROLE_LABEL,
  GRAPH_ROLE_ORDER,
  neighborsOf,
  toForceGraph,
  topicNumber,
  type ForceNode,
} from "@/lib/notes/review/graph-model";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import { cn } from "@/lib/utils";

// 캔버스와 d3 힘 배치는 브라우저에서만 돈다. 서버에서 그릴 판이 없어 이 경계만 SSR 을 끈다.
const ReviewGraphCanvas = dynamic(() => import("@/components/notes/review/review-graph-canvas"), {
  ssr: false,
  loading: () => <Skeleton aria-hidden className="size-full" />,
});

/** 판의 가로세로 비. 요약이 오기 전 자리표시(`review-board`)와 같다 */
const ASPECT = 520 / 840;
const STEP = 1.25;
const REVEAL_MS = 300;
const ZOOM_RANGE: [number, number] = [0.2, 8];

/** 이 폭보다 좁으면 주제 이름 대신 번호만, 중간 폭이면 이름을 더 짧게 자른다 */
export const NARROW_LABEL_WIDTH = 480;
const SHORT_LABEL_WIDTH = 720;

type Tooltip = { node: ForceNode; x: number; y: number };

export function ReviewGraph({
  summary,
  items,
  selectedItemId,
  onSelect,
}: {
  summary: MeetingReviewSummary;
  items: MeetingReviewResponseDataItemsItem[];
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
}) {
  const ready = summary.status === "SUCCEEDED" && summary.topics.length > 0;
  const graph = useMemo(() => buildReviewGraph(summary, items), [summary, items]);
  // 힘 배치는 점 객체에 좌표를 써 넣는다. 같은 그래프면 같은 객체를 넘겨야 배치가 처음부터 다시 돌지 않는다.
  const data = useMemo(() => toForceGraph(graph), [graph]);
  const neighbors = useMemo(() => neighborsOf(data.links), [data]);
  const nodeById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node as GraphNodeObject])), [data]);

  const panelRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphApi | undefined>(undefined);
  const [width, setWidth] = useState(0);
  const [tokens, setTokens] = useState<GraphTokens | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [zoom, setZoom] = useState(1);
  // 어느 그래프의 배치가 멈췄나. 검토본이 바뀌면 새 배치가 다시 돌아 자연히 풀린다.
  const [settledData, setSettledData] = useState<object | null>(null);
  const height = Math.round(width * ASPECT);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const style = getComputedStyle(panel);
    const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    setTokens({
      ink: read("--el-ink", "#0c0a09"),
      muted: read("--el-muted", "#777169"),
      mutedSoft: read("--el-muted-soft", "#a8a29e"),
      card: read("--el-surface-card", "#ffffff"),
      canvas: read("--el-canvas-soft", "#fafafa"),
    });
    setWidth(panel.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [ready]);

  /** 그 점이 판 밖에 있으면 판 가운데로 옮긴다. 안에 있으면 보던 자리를 흔들지 않는다 */
  const reveal = useCallback(
    (id: string) => {
      const node = nodeById.get(id);
      const api = graphRef.current;
      if (!node || !api || node.x === undefined || node.y === undefined) return false;
      const at = api.graph2ScreenCoords(node.x, node.y);
      const margin = 24;
      if (at.x >= margin && at.x <= width - margin && at.y >= margin && at.y <= height - margin) return false;
      api.centerAt(node.x, node.y, REVEAL_MS);
      return true;
    },
    [nodeById, width, height]
  );

  // 관련 항목을 눌러 밖에서 고른 항목이 지금 보이는 영역 밖이면 그 자리로 옮긴다.
  useEffect(() => {
    if (selectedItemId) reveal(selectedItemId);
  }, [selectedItemId, reveal]);

  const point = useCallback(
    (id: string | null) => {
      setHoveredId(id);
      const node = id ? nodeById.get(id) : undefined;
      const api = graphRef.current;
      if (!node || !api) return setTooltip(null);
      const at = api.graph2ScreenCoords(node.x ?? 0, node.y ?? 0);
      setTooltip({ node, x: at.x, y: at.y });
    },
    [nodeById]
  );

  const zoomBy = useCallback((factor: number) => {
    const api = graphRef.current;
    if (api) api.zoom(api.zoom() * factor, 200);
  }, []);
  const fit = useCallback(() => graphRef.current?.zoomToFit(300, 24), []);

  if (!ready) {
    return (
      <p className="py-10 text-center text-sm text-[var(--el-muted)]">
        주제 묶음이 없어 그래프를 그릴 수 없습니다
      </p>
    );
  }

  const lit = hoveredId ? new Set([hoveredId, ...(neighbors.get(hoveredId) ?? [])]) : null;
  const labelLimit = width < NARROW_LABEL_WIDTH ? 0 : width < SHORT_LABEL_WIDTH ? 10 : 16;

  return (
    <div
      onKeyDown={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key === "+" || event.key === "=") zoomBy(STEP);
        else if (event.key === "-" || event.key === "_") zoomBy(1 / STEP);
        else if (event.key === "0") fit();
        else return;
        event.preventDefault();
      }}
    >
      {/* 범례는 그래프 위에 둔다 — 점을 읽기 전에 색과 선의 뜻을 먼저 본다. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--el-muted)]">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--el-ink)]" />
            주제
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="inline-block size-2 rounded-full border-[1.5px] border-[var(--el-ink)]" />
            안건
          </span>
          {GRAPH_ROLE_ORDER.map((role) => (
            <span key={role} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <RoleDot role={role} />
              {GRAPH_ROLE_LABEL[role]}
            </span>
          ))}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="inline-block h-px w-4 bg-[var(--el-muted)]" />
            관계
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="inline-block w-4 border-t border-dashed border-[var(--el-muted-soft)]" />
            다른 주제에도 속함
          </span>
        </span>
      </div>

      <div
        ref={panelRef}
        role="group"
        aria-label="주제별로 묶은 항목 그래프"
        data-review-graph=""
        data-settled={settledData === data ? "" : undefined}
        className="relative overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
        style={{ aspectRatio: `${1 / ASPECT}` }}
      >
        {width > 0 && tokens ? (
          <div aria-hidden className="absolute inset-0">
            <ReviewGraphCanvas
              data={data}
              width={width}
              height={height}
              tokens={tokens}
              labelLimit={labelLimit}
              zoomRange={ZOOM_RANGE}
              hoveredId={hoveredId}
              lit={lit}
              selectedId={selectedItemId}
              graphRef={graphRef}
              onHover={(node) => point(node ? String(node.id) : null)}
              onSelect={(node) => {
                if (node.item) onSelect(node.item.id);
                else graphRef.current?.centerAt(node.x, node.y, 300);
              }}
              onZoom={setZoom}
              onSettled={() => setSettledData(data)}
            />
          </div>
        ) : null}

        {/*
          캔버스는 화면 읽기 프로그램과 키보드가 못 쓴다. 같은 항목을 보이지 않는 목록으로 둔다.
          초점이 오면 캔버스의 그 점과 이웃을 밝히고, 판 밖이면 그 자리로 옮긴다.
        */}
        <ul className="sr-only">
          {graph.nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                data-item-id={node.id}
                aria-label={`${CONTEXT_KIND_LABEL[node.kind]} ${node.content}`}
                aria-pressed={node.id === selectedItemId}
                onClick={() => onSelect(node.id)}
                onFocus={() => {
                  // 판이 옮겨 가는 중에 설명 상자 자리를 재면 옮기기 전 자리에 선다.
                  if (reveal(node.id)) {
                    setHoveredId(node.id);
                    window.setTimeout(() => point(node.id), REVEAL_MS + 20);
                  } else point(node.id);
                }}
                onBlur={() => setHoveredId((current) => (current === node.id ? null : current))}
              />
            </li>
          ))}
        </ul>

        {tooltip && hoveredId === tooltip.node.id ? (
          <div
            key={tooltip.node.id}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-10 w-60 max-w-[calc(100%-24px)] rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3 py-2.5 shadow-e3",
              "animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none",
              tooltip.x > width * 0.6 ? "-translate-x-[calc(100%+14px)]" : "translate-x-[14px]",
              "-translate-y-1/2"
            )}
            style={{ left: tooltip.x, top: Math.min(Math.max(tooltip.y, 40), height - 40) }}
          >
            {tooltip.node.item ? (
              <>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--el-muted)]">
                  <RoleDot role={tooltip.node.item.role} />
                  {CONTEXT_KIND_LABEL[tooltip.node.item.kind]}
                  {tooltip.node.item.group !== null
                    ? ` · ${topicNumber(tooltip.node.item.group)} ${graph.topics.get(tooltip.node.item.group) ?? ""}`
                    : " · 주제 밖"}
                </p>
                <p className="mt-1.5 text-[13px] leading-[19px] text-[var(--el-ink)]">{tooltip.node.item.content}</p>
              </>
            ) : (
              // 허브 이름은 그래프 위에서 잘린다. 온전한 이름은 여기서만 읽힌다
              <>
                <p className="text-[11px] font-medium text-[var(--el-muted)]">주제 · 항목 {tooltip.node.degree}</p>
                <p className="mt-1.5 text-[13px] leading-[19px] font-semibold text-[var(--el-ink)]">{tooltip.node.label}</p>
              </>
            )}
          </div>
        ) : null}

        <p className="pointer-events-none absolute bottom-2.5 left-3 hidden text-xs text-[var(--el-muted)] sm:block">
          항목을 누르면 아래에 수정 기록과 스크립트가 펼쳐집니다
        </p>

        {/* 손가락으로 쓰는 화면에서는 버튼을 40px 로 키우고 가로로 눕혀 그래프를 덜 가린다 */}
        <div className="absolute right-2 bottom-2 flex flex-col divide-y divide-[var(--el-hairline)] overflow-hidden rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] pointer-coarse:flex-row pointer-coarse:divide-x pointer-coarse:divide-y-0">
          <ControlButton label="확대" disabled={zoom >= ZOOM_RANGE[1]} onClick={() => zoomBy(STEP)}>
            <Plus aria-hidden className="size-3.5" />
          </ControlButton>
          <ControlButton label="축소" disabled={zoom <= ZOOM_RANGE[0]} onClick={() => zoomBy(1 / STEP)}>
            <Minus aria-hidden className="size-3.5" />
          </ControlButton>
          <ControlButton label="맞춤" disabled={false} onClick={fit}>
            <Scan aria-hidden className="size-3.5" />
          </ControlButton>
        </div>
      </div>

      {/* 좁은 화면에서는 안내가 점을 가려 그래프 밖 아래에 둔다 */}
      <p className="mt-2 text-xs text-[var(--el-muted)] sm:hidden">
        항목을 누르면 아래에 수정 기록과 스크립트가 펼쳐집니다
      </p>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--el-ink)] disabled:text-[var(--el-muted-soft)] motion-reduce:transition-none pointer-coarse:size-10"
    >
      {children}
    </button>
  );
}
