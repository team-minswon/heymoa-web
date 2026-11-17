"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics/track";

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
  queue = job.catch(() => undefined);
  return job;
}

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
  fallback: React.ReactNode;
  copyButton: React.ReactNode;
}) {
  // mermaid 는 이 id 로 SVG 안 `<style>` 선택자를 짓는다. `useId` 의 `:` 는 선택자를 깬다.
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const theme = useMermaidTheme();
  const result = useMermaidSvg(id, source, theme);
  const [showCode, setShowCode] = useState(false);
  const t = useTranslations("chat.diagram");

  if (result === null) return fallback;
  if ("failed" in result) {
    return (
      <div>
        {fallback}
        <p className="-mt-1 mb-2 text-[11px] text-[var(--el-muted)]">
          {t("failed")}
        </p>
      </div>
    );
  }

  return (
    <div className="my-2 overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--el-hairline)] px-2.5 py-1">
        <span className="truncate font-mono text-[11px] text-[var(--el-muted)]">
          {t("label")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-pressed={showCode}
            className={BUTTON}
            onClick={() => setShowCode((v) => !v)}
          >
            {showCode ? t("showDiagram") : t("showCode")}
          </button>
          {copyButton}
          <Dialog
            onOpenChange={(open) => {
              if (open) track("chat_diagram_expanded");
            }}
          >
            <DialogTrigger className={BUTTON}>
              <Maximize2 aria-hidden className="size-3" />
              {t("expand")}
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
  const t = useTranslations("chat.diagram");
  if (result === null) {
    return <DialogTitle>{t("label")}</DialogTitle>;
  }
  if ("failed" in result) {
    return (
      <>
        <DialogTitle>{t("label")}</DialogTitle>
        <p className="text-[11px] text-[var(--el-muted)]">{t("failed")}</p>
      </>
    );
  }
  return <ZoomView svg={result.svg} />;
}

function RailDiagram({ svg }: { svg: string }) {
  return (
    <div
      data-testid="mermaid-diagram"
      className="flex justify-center p-2.5 [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:w-full"
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

function ZoomView({ svg }: { svg: string }) {
  const box = viewBoxOf(svg) ?? { w: 800, h: 600 };
  const { w, h } = box;
  const elRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<{ fit: View; view: View }>({
    fit: { s: 1, x: 0, y: 0 },
    view: { s: 1, x: 0, y: 0 },
  });
  const { view } = state;
  const t = useTranslations("chat.diagram");
  const pts = useRef(new Map<number, { x: number; y: number }>());
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
        <DialogTitle className="mr-auto">{t("label")}</DialogTitle>
        <button
          type="button"
          aria-label={t("zoomOut")}
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
          aria-label={t("zoomIn")}
          className={BUTTON}
          onClick={() => zoomCenter(ZOOM_STEP)}
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
        <button type="button" className={BUTTON} onClick={reset}>
          {t("fit")}
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
        {t("hint")}
      </p>
    </>
  );
}
