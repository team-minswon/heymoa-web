"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";

import { ROLE_COLOR, RoleDot } from "@/components/notes/review/role-dot";
import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";
import { layoutGraph, type Point } from "@/lib/notes/review/graph-layout";
import {
  buildReviewGraph,
  GRAPH_ROLE_LABEL,
  GRAPH_ROLE_ORDER,
  type GraphNode,
} from "@/lib/notes/review/graph-model";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import { cn } from "@/lib/utils";

const WIDTH = 840;
const HEIGHT = 520;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 1.25;

/** 이 폭보다 좁으면 주제 이름 대신 번호만, 중간 폭이면 이름을 더 짧게 자른다 */
export const NARROW_LABEL_WIDTH = 480;
const SHORT_LABEL_WIDTH = 720;

/** 보이는 영역. 확대 배율과 그 영역의 가운데(배치 좌표)다 */
type View = { scale: number; cx: number; cy: number };

const FIT: View = { scale: 1, cx: WIDTH / 2, cy: HEIGHT / 2 };

/** 배율을 묶고, 가운데를 옮겨도 그래프 밖이 보이지 않게 가둔다. */
function clampView({ scale, cx, cy }: View): View {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  const halfW = WIDTH / (2 * s);
  const halfH = HEIGHT / (2 * s);
  return {
    scale: s,
    cx: Math.min(WIDTH - halfW, Math.max(halfW, cx)),
    cy: Math.min(HEIGHT - halfH, Math.max(halfH, cy)),
  };
}

function boxOf({ scale, cx, cy }: View) {
  const w = WIDTH / scale;
  const h = HEIGHT / scale;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** 화면의 한 점(0~1 비율)을 제자리에 둔 채 배율만 바꾼다. 휠과 두 손가락 확대가 같이 쓴다. */
function zoomAround(from: View, scale: number, relX: number, relY: number): View {
  const box = boxOf(from);
  const pointX = box.x + relX * box.w;
  const pointY = box.y + relY * box.h;
  const next = clampView({ ...from, scale });
  const nextW = WIDTH / next.scale;
  const nextH = HEIGHT / next.scale;
  return clampView({
    scale: next.scale,
    cx: pointX - relX * nextW + nextW / 2,
    cy: pointY - relY * nextH + nextH / 2,
  });
}

const ordinalText = (ordinal: number) => String(ordinal).padStart(2, "0");

type Gesture =
  | { kind: "pan"; pointerId: number; x: number; y: number; from: View }
  | { kind: "pinch"; distance: number; midX: number; midY: number; from: View };

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
  const layout = useMemo(
    () =>
      layoutGraph({
        nodes: graph.nodes.map(({ id, group }) => ({ id, group })),
        edges: graph.edges,
        width: WIDTH,
        height: HEIGHT,
      }),
    [graph]
  );
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const { source, target } of graph.edges) {
      map.set(source, (map.get(source) ?? new Set()).add(target));
      map.set(target, (map.get(target) ?? new Set()).add(source));
    }
    return map;
  }, [graph]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setView] = useState<View>(FIT);
  const [panning, setPanning] = useState(false);
  // 그래프가 실제로 그려진 폭(px). 재기 전에는 배치 폭 그대로 본다.
  const [renderedWidth, setRenderedWidth] = useState(WIDTH);
  const panelRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  const frame = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const pressedByPointer = useRef(false);

  const box = boxOf(view);
  /** 배치 좌표 1이 화면에서 몇 px 인가의 역수. 글자·점·누를 자리를 화면 px 로 고정하는 데 쓴다 */
  const unit = box.w / renderedWidth;
  const labelMode =
    renderedWidth < NARROW_LABEL_WIDTH ? "ordinal" : renderedWidth < SHORT_LABEL_WIDTH ? "short" : "full";
  const labels = useMemo(
    () => placeTopicLabels(graph.nodes, layout, graph.topics, unit, labelMode),
    [graph, layout, unit, labelMode]
  );

  useEffect(() => {
    viewRef.current = view;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) setRenderedWidth(entry.contentRect.width);
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [ready]);

  /**
   * 보이는 영역을 부드럽게 옮긴다. viewBox 는 CSS 로 움직일 수 없어 프레임마다 값을 바꾼다.
   * 움직임을 줄인 사람에게는 한 프레임에 바로 옮긴다.
   */
  const easeTo = useCallback((target: View) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const from = viewRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / 300);
      const eased = 1 - (1 - t) ** 3;
      const mix = (a: number, b: number) => a + (b - a) * eased;
      setView({ scale: mix(from.scale, target.scale), cx: mix(from.cx, target.cx), cy: mix(from.cy, target.cy) });
      frame.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  // 관련 항목을 눌러 밖에서 고른 항목이 지금 보이는 영역 밖이면 그 자리로 옮긴다.
  useEffect(() => {
    if (!selectedItemId) return;
    const at = layout.positions.get(selectedItemId);
    if (!at) return;
    const current = viewRef.current;
    const visible = boxOf(current);
    const margin = 24 / current.scale;
    const inside =
      at.x > visible.x + margin &&
      at.x < visible.x + visible.w - margin &&
      at.y > visible.y + margin &&
      at.y < visible.y + visible.h - margin;
    if (!inside) easeTo(clampView({ ...current, cx: at.x, cy: at.y }));
  }, [selectedItemId, layout, easeTo]);

  const zoomBy = useCallback((factor: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    setView((current) => clampView({ ...current, scale: current.scale * factor }));
  }, []);

  const fit = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    setView(FIT);
  }, []);

  // 휠 확대는 Ctrl/⌘ 을 누를 때만이다. 그냥 굴리면 페이지가 내려가야 한다.
  // React 의 휠 이벤트는 수동(passive)이라 기본 동작을 막으려면 직접 붙인다.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const relX = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;
      const relY = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
      setView((current) =>
        zoomAround(current, current.scale * Math.exp(-event.deltaY * 0.002), relX, relY)
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [ready]);

  if (!ready) {
    return (
      <p className="py-10 text-center text-sm text-[var(--el-muted)]">
        주제 묶음이 없어 그래프를 그릴 수 없습니다
      </p>
    );
  }

  const lit = hoveredId ? new Set([hoveredId, ...(neighbors.get(hoveredId) ?? [])]) : null;
  const hovered = hoveredId ? graph.nodes.find((node) => node.id === hoveredId) : undefined;
  const hoveredAt = hoveredId ? layout.positions.get(hoveredId) : undefined;
  const leave = (id: string) => setHoveredId((current) => (current === id ? null : current));
  const fade = "transition-opacity duration-200 ease-out motion-reduce:transition-none";
  const endPointer = (pointerId: number) => {
    pointers.current.delete(pointerId);
    if (gesture.current?.kind === "pinch" && pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) {
      gesture.current = null;
      setPanning(false);
    }
  };

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
        className="relative overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
      >
        <svg
          ref={svgRef}
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          role="group"
          aria-label="주제별로 묶은 항목 그래프"
          className="block h-auto w-full"
          // 처음 크기에서는 한 손가락으로 끌면 페이지가 스크롤돼야 한다. 확대한 뒤에만 그래프가 끌기를 가져간다.
          style={{
            aspectRatio: `${WIDTH} / ${HEIGHT}`,
            touchAction: view.scale > 1 ? "none" : "pan-x pan-y",
          }}
          onPointerDown={(event) => {
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const touching = [...pointers.current.values()];
            if (touching.length === 2) {
              const [a, b] = touching;
              gesture.current = {
                kind: "pinch",
                distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                midX: (a.x + b.x) / 2,
                midY: (a.y + b.y) / 2,
                from: view,
              };
              event.currentTarget.setPointerCapture?.(event.pointerId);
              setPanning(false);
            } else if (
              touching.length === 1 &&
              view.scale > 1 &&
              (event.target as Element).hasAttribute?.("data-graph-background")
            ) {
              gesture.current = { kind: "pan", pointerId: event.pointerId, x: event.clientX, y: event.clientY, from: view };
              event.currentTarget.setPointerCapture?.(event.pointerId);
              setPanning(true);
            }
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const active = gesture.current;
            const rect = svgRef.current?.getBoundingClientRect();
            if (!active || !rect?.width) return;
            if (active.kind === "pan") {
              if (active.pointerId !== event.pointerId) return;
              const perPixel = WIDTH / active.from.scale / rect.width;
              setView(
                clampView({
                  ...active.from,
                  cx: active.from.cx - (event.clientX - active.x) * perPixel,
                  cy: active.from.cy - (event.clientY - active.y) * perPixel,
                })
              );
              return;
            }
            const [a, b] = [...pointers.current.values()];
            if (!b) return;
            const factor = Math.hypot(a.x - b.x, a.y - b.y) / active.distance;
            setView(
              zoomAround(
                active.from,
                active.from.scale * factor,
                (active.midX - rect.left) / rect.width,
                (active.midY - rect.top) / rect.height
              )
            );
          }}
          onPointerUp={(event) => endPointer(event.pointerId)}
          onPointerCancel={(event) => endPointer(event.pointerId)}
        >
          {/* 빈 바탕을 끌면 보이는 영역이 따라온다. 점 위에서 시작한 누름은 고르기다 */}
          <rect
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
            fill="transparent"
            data-graph-background=""
            className={panning ? "cursor-grabbing" : view.scale > 1 ? "cursor-grab" : undefined}
          />

          {graph.edges.map((edge) => {
            const from = layout.positions.get(edge.source)!;
            const to = layout.positions.get(edge.target)!;
            const adjacent = hoveredId === edge.source || hoveredId === edge.target;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={adjacent ? "var(--el-muted)" : edge.also ? "var(--el-muted-soft)" : "var(--el-hairline-strong)"}
                strokeWidth={adjacent ? 1.2 : 1}
                strokeDasharray={edge.also ? "3 4" : undefined}
                vectorEffect="non-scaling-stroke"
                className={cn("pointer-events-none", fade)}
                style={{ opacity: lit && !adjacent ? 0.4 : 1 }}
              />
            );
          })}

          {/*
            점보다 넓은 누를 자리는 모든 점 아래 한 층에 깐다. 점마다 제 무리 안에 두면 나중에 그린 이웃의
            누를 자리가 앞선 점을 덮어, 보이는 점을 정확히 눌러도 옆 항목이 골라진다.
          */}
          {graph.nodes.map((node) => {
            const at = layout.positions.get(node.id)!;
            const radius = Math.max(node.center ? 8 : 5.5, (node.center ? 5 : 3.5) * unit);
            return (
              <circle
                key={`hit-${node.id}`}
                aria-hidden
                cx={at.x}
                cy={at.y}
                r={Math.max(radius + 6, 14 * unit)}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onSelect(node.id)}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHoveredId(node.id);
                }}
                onPointerLeave={() => leave(node.id)}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const at = layout.positions.get(node.id)!;
            // 좁은 화면에서도 점이 사라지지 않고, 손가락으로 누를 자리는 28px 를 넘게 둔다(아래 층).
            const radius = Math.max(node.center ? 8 : 5.5, (node.center ? 5 : 3.5) * unit);
            const ringRadius = radius + 4 * unit;
            const selected = node.id === selectedItemId;
            const topicTitle = node.group === null ? null : graph.topics.get(node.group);
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${CONTEXT_KIND_LABEL[node.kind]} ${node.content}`}
                aria-pressed={selected}
                data-item-id={node.id}
                className={cn("group cursor-pointer outline-none", fade)}
                style={{ opacity: lit && !lit.has(node.id) ? 0.4 : 1 }}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelect(node.id);
                }}
                // 설명 상자는 마우스로 가리키거나 키보드로 옮겨 왔을 때만 연다. 손가락으로 누르면
                // 가리키기가 끝나지 않아 상자가 떠 있는 채로 남는다.
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHoveredId(node.id);
                }}
                onPointerLeave={() => leave(node.id)}
                onPointerDown={() => {
                  pressedByPointer.current = true;
                }}
                onFocus={() => {
                  if (pressedByPointer.current) {
                    pressedByPointer.current = false;
                    return;
                  }
                  setHoveredId(node.id);
                }}
                onBlur={() => leave(node.id)}
              >
                <title>{topicTitle ? `${node.content} · ${topicTitle}` : node.content}</title>
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={ringRadius}
                  fill="none"
                  stroke="var(--el-ink)"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                  className="hidden group-focus-visible:inline"
                />
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={radius}
                  // 안건은 속이 빈 원이다 — 결론이 아니라 이야기의 뿌리라 역할 색으로 칠하지 않는다.
                  fill={node.kind === "AGENDA" ? "var(--el-surface-card)" : ROLE_COLOR[node.role]}
                  stroke={node.center || node.kind === "AGENDA" ? "var(--el-ink)" : "var(--el-surface-card)"}
                  strokeWidth={node.center ? 2 : 1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {selected ? (
                  <circle
                    cx={at.x}
                    cy={at.y}
                    r={ringRadius}
                    fill="none"
                    stroke="var(--el-ink)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    data-selected-ring=""
                    className="origin-center [transform-box:fill-box] animate-in fade-in-0 zoom-in-50 duration-200 ease-out motion-reduce:animate-none"
                  />
                ) : null}
              </g>
            );
          })}

          {labels.map((label) => (
            <text
              key={label.ordinal}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              aria-hidden
              data-topic-label=""
              className="pointer-events-none select-none"
              fontSize={11.5 * unit}
              fontWeight={600}
              fill="var(--el-ink)"
              stroke="var(--el-canvas-soft)"
              strokeWidth={4 * unit}
              paintOrder="stroke"
            >
              {label.text ? (
                <>
                  <tspan fill="var(--el-muted-soft)" fontWeight={400} fontSize={10.5 * unit}>
                    {ordinalText(label.ordinal)}{" "}
                  </tspan>
                  {label.text}
                </>
              ) : (
                ordinalText(label.ordinal)
              )}
            </text>
          ))}
        </svg>

        {hovered && hoveredAt ? (
          <div
            key={hovered.id}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-10 w-60 max-w-[calc(100%-24px)] rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3 py-2.5 shadow-e3",
              "animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none",
              hoveredAt.x - box.x > box.w * 0.6 ? "-translate-x-[calc(100%+14px)]" : "translate-x-[14px]",
              "-translate-y-1/2"
            )}
            style={{
              left: `${((hoveredAt.x - box.x) / box.w) * 100}%`,
              top: `${((hoveredAt.y - box.y) / box.h) * 100}%`,
            }}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--el-muted)]">
              <RoleDot role={hovered.role} />
              {CONTEXT_KIND_LABEL[hovered.kind]}
              {hovered.group !== null
                ? ` · ${ordinalText(hovered.group)} ${graph.topics.get(hovered.group) ?? ""}`
                : " · 주제 밖"}
            </p>
            <p className="mt-1.5 text-[13px] leading-[19px] text-[var(--el-ink)]">{hovered.content}</p>
          </div>
        ) : null}

        <p className="pointer-events-none absolute bottom-2.5 left-3 hidden text-xs text-[var(--el-muted)] sm:block">
          항목을 누르면 아래에 수정 기록과 스크립트가 펼쳐집니다
        </p>

        {/* 손가락으로 쓰는 화면에서는 버튼을 40px 로 키우고 가로로 눕혀 그래프를 덜 가린다 */}
        <div className="absolute right-2 bottom-2 flex flex-col divide-y divide-[var(--el-hairline)] overflow-hidden rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] pointer-coarse:flex-row pointer-coarse:divide-x pointer-coarse:divide-y-0">
          <ControlButton label="확대" disabled={view.scale >= MAX_SCALE} onClick={() => zoomBy(STEP)}>
            <Plus aria-hidden className="size-3.5" />
          </ControlButton>
          <ControlButton label="축소" disabled={view.scale <= MIN_SCALE} onClick={() => zoomBy(1 / STEP)}>
            <Minus aria-hidden className="size-3.5" />
          </ControlButton>
          <ControlButton label="맞춤" disabled={view.scale === 1} onClick={fit}>
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

/**
 * 주제 이름은 뭉치 위나 아래, 옆 중 점을 가장 적게 가리는 자리에 둔다. 뭉치 한가운데 두면
 * 이름이 점을 덮어 무엇이 이 주제인지 오히려 안 보인다.
 *
 * 글자는 화면 px 로 크기가 고정이라 좁은 화면에서는 배치 좌표로 더 넓은 자리를 차지한다.
 * 그래서 폭에 따라 이름을 더 짧게 자르거나 번호만 남긴다.
 */
function placeTopicLabels(
  nodes: GraphNode[],
  layout: { positions: Map<string, Point>; anchors: Map<number, Point> },
  topics: Map<number, string>,
  unit: number,
  mode: "full" | "short" | "ordinal"
) {
  const points = nodes.map((node) => layout.positions.get(node.id)!);
  const placed: Array<{ x: number; y: number; halfWidth: number }> = [];
  const limit = mode === "full" ? 14 : 8;
  return [...layout.anchors].map(([ordinal, anchor]) => {
    const title = topics.get(ordinal) ?? "";
    const text = mode === "ordinal" ? "" : title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
    const halfWidth = (((text ? text.length + 1 : 0) + 2) * 11 * unit) / 2;
    const spread = Math.max(
      16,
      ...nodes
        .filter((node) => node.group === ordinal)
        .map((node) => {
          const at = layout.positions.get(node.id)!;
          return Math.hypot(at.x - anchor.x, at.y - anchor.y);
        })
    );
    const candidates = [
      { x: anchor.x, y: anchor.y - spread - 12 * unit },
      { x: anchor.x, y: anchor.y + spread + 20 * unit },
      { x: anchor.x - spread - halfWidth, y: anchor.y + 4 * unit },
      { x: anchor.x + spread + halfWidth, y: anchor.y + 4 * unit },
    ].map((spot) => ({
      x: Math.min(WIDTH - halfWidth - 6 * unit, Math.max(halfWidth + 6 * unit, spot.x)),
      y: Math.min(HEIGHT - 8 * unit, Math.max(16 * unit, spot.y)),
    }));
    const cost = (spot: { x: number; y: number }) =>
      points.filter(
        (point) =>
          Math.abs(point.x - spot.x) < halfWidth + 6 * unit && Math.abs(point.y - (spot.y - 4 * unit)) < 12 * unit
      ).length +
      placed.filter(
        (other) => Math.abs(other.x - spot.x) < other.halfWidth + halfWidth && Math.abs(other.y - spot.y) < 16 * unit
      ).length *
        5;
    const best = candidates.reduce((winner, spot) => (cost(spot) < cost(winner) ? spot : winner));
    placed.push({ ...best, halfWidth });
    return { ordinal, text, ...best };
  });
}
