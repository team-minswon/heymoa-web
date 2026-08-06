"use client";

import { AudioLines, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 빈 워크스페이스의 첫 화면. design.pen `kbUlG`(프로젝트 0) / `zRnPTn`(노트 0).
 *
 * **두 빈 상태를 가른다.** 예전에는 하나였고 문구가 "상단바의 새 노트로 첫 회의를
 * 시작하면…"이었는데, 프로젝트가 없으면 그 버튼이 비활성이라 **가리키는 곳이 눌리지 않았다.**
 * 무엇을 먼저 해야 하는지는 화면 어디에도 없었고, 유일한 입구인 「프로젝트 만들기」는
 * 사이드바 왼쪽 아래에 있어 절차의 1단계로 읽히지 않았다.
 *
 * 그래서 단계를 본문 중앙에 적는다. 카드가 하는 일은 **다음에 무엇이 오는지 보여 주는 것**이고,
 * 지금 할 것은 카드 아래 CTA 하나다.
 */
export function WorkspaceOnboarding({
  stage,
  onCreateProject,
  onNewMeeting,
}: {
  /**
   * `no-project`: 워크스페이스만 있다. 프로젝트가 1단계다.
   * `no-note`: 프로젝트는 있고 회의가 없다. 회의가 1단계다.
   */
  stage: "no-project" | "no-note";
  onCreateProject: () => void;
  onNewMeeting: () => void;
}) {
  const first = stage === "no-project";
  const steps = first
    ? [
        {
          title: "프로젝트 만들기",
          detail: "회의를 묶는 상자입니다. 팀·제품·고객 단위로 짓습니다",
        },
        { title: "회의 만들기", detail: "프로젝트 안에 회의를 만듭니다" },
        { title: "기록하고 요약 확인", detail: "종료하면 자동으로 정리됩니다" },
      ]
    : [
        { title: "회의 만들기", detail: "이름을 지어 두면 나중에 찾기 쉽습니다" },
        { title: "기록 시작", detail: "마이크 권한이 필요합니다" },
        { title: "요약 확인", detail: "종료하면 자동으로 정리됩니다" },
      ];

  return (
    <div
      data-testid="workspace-onboarding"
      data-stage={stage}
      className="flex min-h-80 flex-col items-center justify-center rounded-panel border border-dashed border-[var(--el-hairline-strong)] px-6 py-12 text-center"
    >
      <AudioLines className="size-8 text-[var(--el-muted)]" aria-hidden />
      <h2 className="mt-4 font-serif text-2xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
        {first ? "회의를 담을 프로젝트부터" : "첫 회의를 기록해 보세요"}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--el-body)]">
        {first
          ? "회의는 프로젝트 안에 만들어집니다. 하나만 만들어 두면 바로 회의를 시작할 수 있습니다."
          : "회의를 만들고 시작하면 대화가 실시간으로 전사되고, 끝나면 개요 · 액션 아이템 · 인사이트로 정리됩니다."}
      </p>
      {/* 좁은 화면에서는 세로로 쌓는다 — 250×3이면 750이라 셸 패널 안에서 감긴다. */}
      <ol className="mt-7 flex w-full max-w-3xl flex-col gap-3 text-left sm:flex-row">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex-1 rounded-control border border-[var(--el-hairline)] bg-white p-4"
          >
            <span className="text-[11px] font-bold text-[var(--el-muted)]">
              {index + 1}
            </span>
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--el-ink)]">
              {step.title}
            </p>
            <p className="mt-1.5 text-[11px] leading-[1.55] text-[var(--el-muted)]">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
      {/* CTA는 **1단계 하나만** 가리킨다. 둘을 나란히 두면 어느 쪽이 먼저인지 다시 헷갈린다. */}
      <Button
        type="button"
        className="mt-7 rounded-full px-4"
        onClick={first ? onCreateProject : onNewMeeting}
      >
        <Plus className="size-3.5" />
        {first ? "첫 프로젝트 만들기" : "새 회의 만들기"}
      </Button>
    </div>
  );
}
