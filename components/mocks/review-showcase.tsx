"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { cn } from "@/lib/utils";

const WORKSPACE_ID = "01K0000000000";
const summaryOf = (noteId: string) => `/w/${WORKSPACE_ID}/notes/${noteId}?view=full&tab=summary`;

export type Scenario = {
  key: string;
  group: string;
  title: string;
  path: string;
  tryThis: string[];
};

/** 목 시드의 노트마다 한 상태. 무엇을 눌러 볼지를 함께 둬서, 화면을 모르는 사람도 전부 밟아 본다. */
export const SCENARIOS: Scenario[] = [
  {
    key: "review",
    group: "검토",
    title: "검토 가능 · 요약과 그래프",
    path: summaryOf("01K0000000920"),
    tryThis: [
      "주제 칩으로 항목 거르기",
      "줄을 눌러 수정 기록 → 스크립트 펼치기",
      "할 일의 담당 · 기한 칸 고치기",
      "수정 · 제외 · 제외 취소 · 섹션에 추가",
      "이전 결정 끝내기 · 기존 할 일 반영",
      "그래프로 바꿔 확대 · 이동 · 항목 고르기",
      "검토 완료",
    ],
  },
  {
    key: "analyzing",
    group: "분석 흐름",
    title: "분석 중 → 검토 가능",
    path: summaryOf("01K0000000022"),
    tryThis: ["진행 표시를 보고 몇 초 기다리면 검토 화면으로 넘어갑니다"],
  },
  {
    key: "diarizing",
    group: "분석 흐름",
    title: "화자 분리 중 → 분석 중 → 검토 가능",
    path: summaryOf("01K0000000025"),
    tryThis: ["단계 표시가 차례로 넘어갑니다"],
  },
  {
    key: "failed",
    group: "분석 흐름",
    title: "분석 실패 · 다시 분석",
    path: summaryOf("01K0000000026"),
    tryThis: ["다시 분석을 누르면 진행으로 넘어가고, 곧 검토 화면이 섭니다"],
  },
  {
    key: "waiting",
    group: "분석 흐름",
    title: "분석 요청 전 · 다른 사람이 시작한 회의",
    path: summaryOf("01K0000000023"),
    tryThis: ["회의 시작자가 아니라 요청 버튼 대신 안내가 섭니다"],
  },
  {
    key: "readonly",
    group: "읽기",
    title: "다른 사람이 시작한 회의 · 요약 없음",
    path: summaryOf("01K0000000021"),
    tryThis: ["고치는 조작 없이 섹션만 읽고, 개요 자리에 요약이 없다고 말합니다"],
  },
  {
    key: "confirmed",
    group: "읽기",
    title: "확정된 회의",
    path: summaryOf("01K0000000024"),
    tryThis: ["확정됨으로 서고 확정 줄이 없습니다"],
  },
  {
    key: "legacy",
    group: "읽기",
    title: "지난 노트 · 구형 요약",
    path: summaryOf("01K0000000020"),
    tryThis: ["구형 요약을 읽기만 합니다"],
  },
  {
    key: "tasks",
    group: "할 일",
    title: "전체 할 일",
    path: `/w/${WORKSPACE_ID}/tasks`,
    tryThis: [
      "진행 중 · 완료 · 취소 바꾸기",
      "내 할 일 · 프로젝트로 거르기",
      "완료 표시 · 담당 · 기한 고치기",
      "줄을 눌러 이력 시트 열기 · 할 일 추가",
    ],
  },
];

type Device = "both" | "desktop" | "mobile";

const DEVICES = [
  { value: "both", label: "나란히" },
  { value: "desktop", label: "데스크톱" },
  { value: "mobile", label: "모바일" },
] as const;

const FRAMES = {
  desktop: { label: "데스크톱 1280", width: 1280, height: 800 },
  mobile: { label: "모바일 390", width: 390, height: 844 },
} as const;

export function ReviewShowcase() {
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key);
  const [device, setDevice] = useState<Device>("both");
  const [reloads, setReloads] = useState(0);
  const scenario = SCENARIOS.find((row) => row.key === scenarioKey) ?? SCENARIOS[0];
  const groups = [...new Set(SCENARIOS.map((row) => row.group))];
  const frameKey = `${scenario.key}-${reloads}`;

  return (
    <div className="min-h-dvh bg-[var(--el-canvas)] text-[var(--el-ink)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-4 py-3 sm:px-6">
        <h1 className="font-serif text-xl font-light tracking-[-0.02em]">회의 뒤 검토 미리보기</h1>
        <span className="text-xs text-[var(--el-muted)]">
          목 데이터 · 화면마다 따로 돌고, 다시 불러오면 처음 상태로 돌아갑니다
        </span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <SegmentedControl label="화면 폭" value={device} options={DEVICES} onChange={setDevice} />
          <button
            type="button"
            onClick={() => setReloads((count) => count + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--el-hairline-strong)] px-3 text-xs font-medium hover:bg-[var(--el-canvas-soft)]"
          >
            <RotateCcw aria-hidden className="size-3.5" />
            다시 불러오기
          </button>
          <a
            href={scenario.path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--el-hairline-strong)] px-3 text-xs font-medium hover:bg-[var(--el-canvas-soft)]"
          >
            <ExternalLink aria-hidden className="size-3.5" />
            새 탭
          </a>
        </div>
      </header>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="장면" className="space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1.5 px-1 text-[11px] font-medium text-[var(--el-muted-soft)]">{group}</p>
              <ul className="space-y-0.5">
                {SCENARIOS.filter((row) => row.group === group).map((row) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      aria-current={row.key === scenario.key ? "page" : undefined}
                      onClick={() => setScenarioKey(row.key)}
                      className={cn(
                        "w-full rounded-control px-3 py-2 text-left text-[13px] transition-colors duration-200",
                        row.key === scenario.key
                          ? "bg-[var(--el-surface-card)] font-medium shadow-[0_1px_2px_#0c0a0914]"
                          : "text-[var(--el-body)] hover:bg-[var(--el-surface-card)]"
                      )}
                    >
                      {row.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div
            key={scenario.key}
            className="rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] p-3 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          >
            <p className="text-xs font-semibold">해 볼 것</p>
            <ul aria-label="해 볼 것" className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[var(--el-body)]">
              {scenario.tryThis.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        </nav>

        <div
          className={cn(
            "grid min-w-0 items-start gap-5",
            device === "both" && "2xl:grid-cols-[minmax(0,1fr)_390px]"
          )}
        >
          {device !== "mobile" ? (
            <DeviceFrame frame={FRAMES.desktop} src={scenario.path} frameKey={frameKey} />
          ) : null}
          {device !== "desktop" ? (
            <DeviceFrame frame={FRAMES.mobile} src={scenario.path} frameKey={frameKey} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 실제 화면을 그 폭 그대로 띄우고, 자리가 모자라면 통째로 줄인다. 줄여도 레이아웃은 그 폭의 것이다. */
function DeviceFrame({
  frame,
  src,
  frameKey,
}: {
  frame: (typeof FRAMES)[keyof typeof FRAMES];
  src: string;
  frameKey: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(Math.min(1, entry.contentRect.width / frame.width))
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [frame.width]);

  return (
    <figure className="min-w-0" style={{ maxWidth: frame.width }}>
      <figcaption className="mb-1.5 font-mono text-[11px] text-[var(--el-muted)]">{frame.label}</figcaption>
      <div ref={box} className="w-full">
        <div
          className="overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2"
          style={{ height: frame.height * scale }}
        >
          <iframe
            key={frameKey}
            title={`${frame.label} 미리보기`}
            src={src}
            className="block origin-top-left border-0"
            style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </figure>
  );
}
