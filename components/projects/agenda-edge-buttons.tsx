"use client";

import { useEffect, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EDGE_BUTTON = 32;
const EDGE_STEP = 0.8;

const SIDES = ["left", "right"] as const;

export function EdgeButtons({
  scroller,
  reduced,
  inset = 0,
  className,
}: {
  scroller: RefObject<HTMLElement | null>;
  reduced: boolean;
  inset?: number;
  className?: string;
}) {
  const t = useTranslations("workspace.agendaMap");
  const [edge, setEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const read = () => {
      const next = { left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 };
      setEdge((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    read();
    element.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [scroller]);

  const go = (direction: -1 | 1) => {
    const element = scroller.current;
    if (element) element.scrollBy({ left: direction * Math.round(element.clientWidth * EDGE_STEP), behavior: reduced ? "auto" : "smooth" });
  };
  const middle = inset / 2;
  const shown = edge.left || edge.right;
  return (
    <div
      data-edge-buttons=""
      className={cn("pointer-events-none sticky z-[5] w-full", className)}
      style={{
        top: `calc(50% + ${middle - EDGE_BUTTON / 2}px)`,
        bottom: `calc(50% - ${middle + EDGE_BUTTON / 2}px)`,
        height: EDGE_BUTTON,
        marginBottom: -EDGE_BUTTON,
      }}
    >
      {shown
        ? SIDES.map((side) => {
            const Icon = side === "left" ? ChevronLeft : ChevronRight;
            return (
              <div key={side} inert={!edge[side]} className={cn("absolute top-0", side === "left" ? "left-2" : "right-2")}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={side === "left" ? t("scrollLeft") : t("scrollRight")}
                  onClick={() => go(side === "left" ? -1 : 1)}
                  className={cn(
                    "rounded-full border-border bg-[color-mix(in_srgb,var(--el-surface-card)_94%,transparent)] shadow-e2 transition-opacity duration-[120ms] motion-reduce:duration-100",
                    edge[side] ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </Button>
              </div>
            );
          })
        : null}
    </div>
  );
}
