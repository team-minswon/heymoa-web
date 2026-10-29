"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { animate, motion, useReducedMotion } from "motion/react";

import { FADE_REDUCED } from "@/components/projects/agenda-ribbon-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { cn } from "@/lib/utils";

type View = "notes" | "map";

/** 이동 한 번에 움직이는 것은 둘뿐이다: 선택 밑줄(0.2초)과 본문 덩어리(0.18초 페이드 + 6px 올라옴). 둘은 같은 시간대에 끝난다 */
const SLIDE = { duration: 0.2, ease: "easeOut" } as const;
const BODY = { duration: 0.18, ease: "easeOut" } as const;
const BODY_OUT = { duration: 0.09, ease: "easeOut" } as const;
const RISE = 6;
const FRESH_MS = 2500;

// 「노트」와 「연결 지도」는 다른 주소(다른 페이지)라 탭을 누르면 페이지가 바뀌고, 탭 줄은 새로 선다. 두 페이지의 제목·탭 줄은 같은 틀(같은 바깥 폭·
// 왼쪽 기준선·위쪽 여백)이라 제자리에 있고, 밑줄은 직전 페이지에서 서 있던 자리(`lastBox`)에서 새 탭 아래로 미끄러진다(페이지가 달라 `layoutId` 를
// 쓸 수 없다). 본문은 떠나는 쪽이 먼저 옅어지고(`bodyElement`) 들어오는 쪽이 올라오며 옅게 나타난다(`arrived`). 새로고침·사이드바로 들어온 페이지는 움직이지 않는다.
let arrived = 0;
let lastBox: { left: number; width: number; at: number } | null = null;
let bodyElement: HTMLElement | null = null;

/**
 * 프로젝트 하나를 보는 두 화면의 전환 탭 — 「노트」(그 프로젝트의 노트 목록)와 「연결 지도」. 두 화면이 같은 자리에 같은 탭을 두어,
 * 프로젝트를 눌렀을 때 나오는 노트 목록에서 지도가 있다는 것을 알 수 있고 거기서 되돌아올 수도 있다.
 *
 * 다른 화면으로 가는 것이라 라디오(`SegmentedControl`)가 아니라 밑줄 탭이고, 각 칸이 링크다. 프로젝트 선택은 셸 상태
 * (`selectedProjectId`)가 쥐고 있어서, 지도에서 「노트」로 돌아올 때 그 프로젝트를 다시 골라 둔다.
 */
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
      <TabsList ref={listRef} variant="line" aria-label="프로젝트 보기" className="relative gap-5 p-0 group-data-horizontal/tabs:h-10">
        <TabsTrigger value="notes" nativeButton={false} render={<Link href={notesHref} onNavigate={go("notes", notesHref)} />} className={TAB_ITEM}>
          노트
        </TabsTrigger>
        <TabsTrigger value="map" nativeButton={false} render={<Link href={mapHref} onNavigate={go("map", mapHref)} />} className={TAB_ITEM}>
          연결 지도
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

/**
 * 두 화면의 본문 한 덩어리. 탭을 눌러 건너온 경우에만 옅게 나타나며 6px 올라온다. 안쪽 자식들은 각자 나타나는 움직임이 없고 이 덩어리만 움직인다.
 * `enabled` 가 아니면(프로젝트를 고르지 않은 「모든 노트」) 그냥 자식을 둔다 — 같은 자리에 같은 요소라 켜고 꺼도 자식은 다시 만들어지지 않는다.
 */
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
