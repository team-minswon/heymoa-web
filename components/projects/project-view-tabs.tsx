"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { animate, motion, useReducedMotion } from "motion/react";

import { FADE_REDUCED } from "@/components/projects/agenda-ribbon-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { cn } from "@/lib/utils";

type View = "notes" | "map";

const SLIDE = { duration: 0.2, ease: "easeOut" } as const;
const BODY = { duration: 0.18, ease: "easeOut" } as const;
const BODY_OUT = { duration: 0.09, ease: "easeOut" } as const;
const RISE = 6;
const FRESH_MS = 2500;

let arrived = 0;
let lastBox: { left: number; width: number; at: number } | null = null;
let bodyElement: HTMLElement | null = null;

export function ProjectViewTabs({
  workspaceId,
  projectId,
  current,
  className,
}: {
  workspaceId: string;
  projectId: string;
  current: View;
  className?: string;
}) {
  const t = useTranslations("workspace.projectTabs");
  const { setSelectedProjectId } = useWorkspaceShell();
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [from] = useState(() => (lastBox && performance.now() - lastBox.at < FRESH_MS ? lastBox : null));

  useLayoutEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("[role=tab][aria-selected=true]");
    if (!active) return;
    const next = { left: active.offsetLeft, width: active.offsetWidth };
    setBox(next);
    lastBox = { ...next, at: performance.now() };
  }, [current]);

  const go = (target: View, href: string) => (event: { preventDefault: () => void }) => {
    if (target === current) return;
    arrived = performance.now();
    if (lastBox) lastBox.at = arrived;
    if (target === "notes") setSelectedProjectId(projectId);
    if (bodyElement && !reduced) {
      event.preventDefault();
      void animate(bodyElement, { opacity: 0 }, BODY_OUT).finished.then(() => router.push(href));
    }
  };
  const notesHref = `/w/${workspaceId}`;
  const mapHref = `/w/${workspaceId}/projects/${projectId}`;

  return (
    <Tabs value={current} className={cn("gap-0", className)}>
      <TabsList ref={listRef} variant="line" aria-label={t("label")} className="relative gap-5 p-0 group-data-horizontal/tabs:h-10">
        <TabsTrigger value="notes" nativeButton={false} render={<Link href={notesHref} onNavigate={go("notes", notesHref)} />} className={TAB_ITEM}>
          {t("notes")}
        </TabsTrigger>
        <TabsTrigger value="map" nativeButton={false} render={<Link href={mapHref} onNavigate={go("map", mapHref)} />} className={TAB_ITEM}>
          {t("map")}
        </TabsTrigger>
        {box ? (
          <motion.span
            aria-hidden
            data-tab-underline=""
            initial={from && !reduced ? { left: from.left, width: from.width } : false}
            animate={{ left: box.left, width: box.width }}
            transition={reduced ? { duration: 0 } : SLIDE}
            className="pointer-events-none absolute bottom-0 h-0.5 bg-foreground"
          />
        ) : null}
      </TabsList>
    </Tabs>
  );
}

export function ProjectViewBody({ enabled = true, className, children }: { enabled?: boolean; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const [fresh] = useState(() => enabled && arrived > 0 && performance.now() - arrived < FRESH_MS);
  return (
    <motion.div
      ref={(element) => {
        bodyElement = enabled ? element : bodyElement === element ? null : bodyElement;
      }}
      data-view-body=""
      initial={fresh ? { opacity: 0, y: reduced ? 0 : RISE } : false}
      animate={{ opacity: 1, y: 0, transition: reduced ? FADE_REDUCED : BODY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const TAB_ITEM =
  "h-10 flex-none px-0 text-[13px] group-data-horizontal/tabs:after:bottom-0 group-data-[variant=line]/tabs-list:data-active:after:opacity-0";
