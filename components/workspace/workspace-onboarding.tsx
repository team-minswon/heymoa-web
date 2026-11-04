"use client";

import { AudioLines, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("workspace.onboarding");
  const first = stage === "no-project";
  const keys = first
    ? (["createProject", "createMeeting", "recordAndReview"] as const)
    : (["nameMeeting", "startRecording", "reviewSummary"] as const);
  const steps = keys.map((key) => ({
    key,
    title: t(`steps.${key}.title`),
    detail: t(`steps.${key}.detail`),
  }));

  return (
    <div
      data-testid="workspace-onboarding"
      data-stage={stage}
      className="flex min-h-80 flex-col items-center justify-center rounded-panel border border-dashed border-[var(--el-hairline-strong)] px-6 py-12 text-center"
    >
      <AudioLines className="size-8 text-[var(--el-muted)]" aria-hidden />
      <h2 className="mt-4 text-2xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
        {first ? t("titleNoProject") : t("titleNoNote")}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--el-body)]">
        {first ? t("descriptionNoProject") : t("descriptionNoNote")}
      </p>
      {/* 좁은 화면에서는 세로로 쌓는다 — 250×3이면 750이라 셸 패널 안에서 감긴다. */}
      <ol className="mt-7 flex w-full max-w-3xl flex-col gap-3 text-left sm:flex-row">
        {steps.map((step, index) => (
          <li
            key={step.key}
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
        {first ? t("ctaNoProject") : t("ctaNoNote")}
      </Button>
    </div>
  );
}
