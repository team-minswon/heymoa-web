"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/*
 * ```mermaid 코드펜스를 도표로 그린다.
 *
 * - `mermaid` 는 수 MB 라 `import()` 로 첫 도표가 나올 때만 받는다. 초기 번들에 안 든다.
 * - `securityLevel: "strict"` — 라벨의 HTML 을 DOMPurify 로 걸러내고 클릭 바인딩을 끈다.
 *   `htmlLabels: false` 로 라벨을 `<foreignObject>` HTML 이 아니라 SVG 글자로 그린다.
 *   모델이 도구 결과를 옮겨 적을 수 있어 원문은 믿지 않는다. 넣는 것은 결과 SVG 뿐이다.
 * - 못 그리면 조용히 코드로 되돌린다. 오류 SVG 를 문서에 끼우지 않고 로그도 끈다.
 */

type Mermaid = (typeof import("mermaid"))["default"];
let loading: Promise<Mermaid> | null = null;
function loadMermaid(): Promise<Mermaid> {
  loading ??= import("mermaid").then((m) => m.default);
  return loading;
}

type Theme = "neutral" | "dark";
type Result = { svg: string } | { failed: true } | null;

/**
 * 모든 렌더가 지나는 한 줄 큐. `initialize` 는 전역 설정이라 렌더 둘이 겹치면 한쪽 테마가 다른
 * 쪽에 섞인다. 설정과 렌더를 한 작업으로 묶어 차례로 돌린다.
 */
let queue: Promise<unknown> = Promise.resolve();
export function renderMermaid(
  id: string,
  source: string,
  theme: Theme
): Promise<string> {
  const job = queue.then(async () => {
    const mermaid = await loadMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      suppressErrorRendering: true,
      logLevel: "fatal",
      theme,
    });
    return (await mermaid.render(id, source)).svg;
  });
  // 실패해도 다음 작업은 돈다.
  queue = job.catch(() => undefined);
  return job;
}

/** `id` 로 그린 SVG. 테마가 바뀌면 다시 그린다. 떠난 뒤 늦게 온 결과는 버린다. */
function useMermaidSvg(id: string, source: string, theme: Theme): Result {
  const [result, setResult] = useState<Result>(null);
  useEffect(() => {
    let live = true;
    renderMermaid(id, source, theme).then(
      (svg) => live && setResult({ svg }),
      () => live && setResult({ failed: true })
    );
    return () => {
      live = false;
    };
  }, [id, source, theme]);
  return result;
}

function useMermaidTheme(): Theme {
  return useTheme().resolvedTheme === "dark" ? "dark" : "neutral";
}

const BUTTON =
  "inline-flex shrink-0 items-center gap-1 rounded-control px-1.5 py-0.5 text-[11px] text-[var(--el-muted)] hover:text-[var(--el-ink)]";

export function MermaidBlock({
  source,
  fallback,
  copyButton,
}: {
  source: string;
  /** 그리기 전·못 그렸을 때 보일 코드블록. */
  fallback: React.ReactNode;
  copyButton: React.ReactNode;
}) {
  // mermaid 는 이 id 로 SVG 안 `<style>` 선택자를 짓는다. `useId` 의 `:` 는 선택자를 깬다.
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const theme = useMermaidTheme();
  const result = useMermaidSvg(id, source, theme);
  const [showCode, setShowCode] = useState(false);

  if (result === null) return fallback;
  if ("failed" in result) {
    return (
      <div>
        {fallback}
        <p className="-mt-1 mb-2 text-[11px] text-[var(--el-muted)]">
          도표를 그리지 못했어요
        </p>
      </div>
    );
  }

  return (
    <div className="my-2 overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--el-hairline)] px-2.5 py-1">
        <span className="truncate font-mono text-[11px] text-[var(--el-muted)]">
          도표
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-pressed={showCode}
            className={BUTTON}
            onClick={() => setShowCode((v) => !v)}
          >
            {showCode ? "도표 보기" : "코드 보기"}
          </button>
          {copyButton}
          <Dialog>
            <DialogTrigger className={BUTTON}>
              <Maximize2 aria-hidden className="size-3" />
              크게 보기
            </DialogTrigger>
            <DialogContent className="grid h-[85vh] w-[90vw] max-w-[90vw] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[90vw]">
              <ModalDiagram id={`${id}-lg`} source={source} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {showCode ? (
        <pre className="overflow-x-auto p-2.5 font-mono text-xs leading-relaxed">
          <code>{source}</code>
        </pre>
      ) : (
        <RailDiagram svg={result.svg} />
      )}
    </div>
  );
}

/**
 * 모달 안 도표. 레일과 같은 SVG 를 다시 넣으면 marker·clipPath·`<style>` 의 `#id` 가 문서에 둘이
 * 되어 화살표·스타일이 엉뚱한 쪽을 가리킨다. 열 때 새 id 로 다시 그린다.
 */
function ModalDiagram({ id, source }: { id: string; source: string }) {
  const result = useMermaidSvg(id, source, useMermaidTheme());
  if (result === null) {
    return <DialogTitle>도표</DialogTitle>;
  }
  if ("failed" in result) {
    return (
      <>
        <DialogTitle>도표</DialogTitle>
        <p className="text-[11px] text-[var(--el-muted)]">
          도표를 그리지 못했어요
        </p>
      </>
    );
  }
  return <ZoomView svg={result.svg} />;
}

/**
 * 레일 안 도표. 자르지 않고 칸에 통째로 맞춘다(contain). 폭 100%·높이 auto 에 최대 높이를 걸면
 * viewBox 비율이 유지된 채 더 줄어든다. 가로 스크롤을 만들지 않는다.
 */
function RailDiagram({ svg }: { svg: string }) {
  return (
    <div
      data-testid="mermaid-diagram"
      className="flex justify-center p-2.5 [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:w-full"
      // mermaid 가 strict 로 걸러 낸 SVG 문자열이다. 원문을 넣지 않는다.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function viewBoxOf(svg: string): { w: number; h: number } | null {
  const m = /viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(
    svg
  );
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

const ZOOM_STEP = 1.25;
type View = { s: number; x: number; y: number };

type Snap = { cx: number; cy: number; dist: number; view: View };

/**
 * 기준 순간(`b`)에서 지금(`now`)으로. 손가락 중심 아래 점이 중심을 따라가고, 두 손가락이면
 * 거리 비율만큼 배율도 바꾼다. 한 손가락이면 배율 1 이라 그냥 이동이다.
 */
function moved(st: { fit: View; view: View }, b: Snap, now: Snap) {
  const raw =
    b.dist > 0 && now.dist > 0 ? b.view.s * (now.dist / b.dist) : b.view.s;
  const s = Math.min(st.fit.s * 4, Math.max(st.fit.s * 0.5, raw));
  const k = s / b.view.s;
  return {
    ...st,
    view: {
      s,
      x: now.cx - (b.cx - b.view.x) * k,
      y: now.cy - (b.cy - b.view.y) * k,
    },
  };
}

/** (px, py) 를 제자리에 둔 채 배율을 `factor` 만큼 바꾼다. 맞춤의 0.5~4배로 묶는다. */
function zoomed(
  st: { fit: View; view: View },
  factor: number,
  px: number,
  py: number
) {
  const v = st.view;
  const s = Math.min(st.fit.s * 4, Math.max(st.fit.s * 0.5, v.s * factor));
  const k = s / v.s;
  return { ...st, view: { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k } };
}

/**
 * 모달 안 도표. CSS transform 하나(translate + scale)로 움직인다.
 * 열리면 창에 맞춰 가운데 둔다. 배율은 맞춤의 0.5~4배. 끌어서 이동, Ctrl/⌘+휠(트랙패드 핀치)은
 * 커서 기준 확대, 일반 휠은 이동, 두 손가락은 핀치, 두 번 누르면 맞춤.
 */
function ZoomView({ svg }: { svg: string }) {
  const box = viewBoxOf(svg) ?? { w: 800, h: 600 };
  const { w, h } = box;
  const elRef = useRef<HTMLDivElement | null>(null);
  // 맞춤과 지금 보기를 한 상태에 둔다. 갱신 함수 안에서 맞춤을 읽어 휠 핸들러가 낡지 않는다.
  const [state, setState] = useState<{ fit: View; view: View }>({
    fit: { s: 1, x: 0, y: 0 },
    view: { s: 1, x: 0, y: 0 },
  });
  const { view } = state;
  /** 눌린 손가락·포인터. 하나면 이동, 둘이면 핀치. */
  const pts = useRef(new Map<number, { x: number; y: number }>());
  /** 포인터 수가 바뀐 순간의 기준. 움직임은 늘 이 기준에서 다시 계산한다. */
  const base = useRef<Snap | null>(null);

  /**
   * 붙는 순간 창에 맞추고 리스너를 건다. 휠은 passive 가 아니어야 페이지 스크롤·확대를 막는다
   * (React onWheel 은 passive). 창 크기가 바뀌면 아직 맞춤 그대로일 때만 다시 맞춘다.
   */
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      elRef.current = el;
      if (!el) return;
      const fitOf = (): View => {
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        // 재지 못하면(jsdom) 원래 크기로 둔다.
        if (cw <= 0 || ch <= 0) return { s: 1, x: 0, y: 0 };
        const s = Math.min(cw / w, ch / h) * 0.95;
        return { s, x: (cw - w * s) / 2, y: (ch - h * s) / 2 };
      };
      const f = fitOf();
      setState({ fit: f, view: f });
      const onResize = () => {
        const next = fitOf();
        setState((st) => ({
          fit: next,
          view: st.view === st.fit ? next : st.view,
        }));
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const r = el.getBoundingClientRect();
          setState((st) =>
            zoomed(
              st,
              Math.exp(-e.deltaY * 0.01),
              e.clientX - r.left,
              e.clientY - r.top
            )
          );
        } else {
          setState((st) => ({
            ...st,
            view: {
              ...st.view,
              x: st.view.x - e.deltaX,
              y: st.view.y - e.deltaY,
            },
          }));
        }
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("resize", onResize);
      return () => {
        el.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onResize);
      };
    },
    [w, h]
  );

  const snap = (el: HTMLElement, v: View): Snap | null => {
    const list = [...pts.current.values()];
    if (list.length === 0) return null;
    const r = el.getBoundingClientRect();
    const cx = list.reduce((sum, p) => sum + p.x, 0) / list.length - r.left;
    const cy = list.reduce((sum, p) => sum + p.y, 0) / list.length - r.top;
    const dist =
      list.length === 2
        ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y)
        : 0;
    return { cx, cy, dist, view: v };
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
    base.current = snap(e.currentTarget, view);
  };

  const zoomCenter = (factor: number) => {
    const el = elRef.current;
    const cx = (el?.clientWidth ?? 0) / 2;
    const cy = (el?.clientHeight ?? 0) / 2;
    setState((st) => zoomed(st, factor, cx, cy));
  };
  const reset = () => setState((st) => ({ ...st, view: st.fit }));

  return (
    <>
      <div className="flex items-center gap-1 pr-8">
        <DialogTitle className="mr-auto">도표</DialogTitle>
        <button
          type="button"
          aria-label="축소"
          className={BUTTON}
          onClick={() => zoomCenter(1 / ZOOM_STEP)}
        >
          <Minus aria-hidden className="size-3.5" />
        </button>
        <span
          data-testid="mermaid-zoom"
          className="w-10 text-center font-mono text-[11px] text-[var(--el-muted)] tabular-nums"
        >
          {Math.round(view.s * 100)}%
        </span>
        <button
          type="button"
          aria-label="확대"
          className={BUTTON}
          onClick={() => zoomCenter(ZOOM_STEP)}
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
        <button type="button" className={BUTTON} onClick={reset}>
          맞춤
        </button>
      </div>
      <div
        ref={attach}
        className="relative min-h-0 cursor-grab touch-none overflow-hidden rounded-block bg-[var(--el-canvas-soft)] select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          base.current = snap(e.currentTarget, view);
        }}
        onPointerMove={(e) => {
          if (!pts.current.has(e.pointerId)) return;
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const b = base.current;
          const now = snap(e.currentTarget, view);
          if (b && now) setState((st) => moved(st, b, now));
        }}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={reset}
      >
        <div
          className="absolute top-0 left-0 origin-top-left [&_svg]:!h-full [&_svg]:!w-full [&_svg]:!max-w-none"
          style={{
            width: box.w,
            height: box.h,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <p className="text-center text-[11px] text-[var(--el-muted)]">
        끌어서 이동 · Ctrl/⌘+휠로 확대 · 두 번 누르면 맞춤
      </p>
    </>
  );
}
