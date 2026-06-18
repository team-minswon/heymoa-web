import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FileWarning,
  ListChecks,
} from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "공모전 AI 일러스트 확인",
  description:
    "일러스트 공모전, 디자인 공모전, 그림 공모전에서 접수된 이미지의 AI 생성 의심 여부와 검토 근거를 관리하는 운영용 AI 일러스트 검사 흐름입니다.",
  alternates: {
    canonical: "/contest-ai-check",
  },
  keywords: [
    "일러스트 공모전 AI 검사",
    "일러스트 공모전 AI 확인",
    "공모전 AI 일러스트 검사",
    "일러스트 공모전 AI 그림",
    "디자인 공모전 AI 검증",
    "그림 공모전 AI 검사",
    "AI 생성 일러스트 접수 불가",
    "AI 확인 검사",
  ],
};

const flows = [
  {
    title: "접수 이미지 1차 확인",
    body: "온라인으로 제출된 일러스트, 디자인, 그림 파일을 작품 단위로 등록하고 AI 이미지 검사 결과를 남깁니다.",
    icon: ClipboardCheck,
  },
  {
    title: "검토 근거 보관",
    body: "AI 생성 의심 점수, 메타데이터, 국소 영역 신호를 함께 남겨 운영자와 심사자가 같은 기준으로 확인할 수 있게 합니다.",
    icon: FileWarning,
  },
  {
    title: "후처리 상태 관리",
    body: "허용, 라벨 필요, 검토 보류, 차단 같은 상태를 기준으로 수상 전후 검증과 이의 대응 흐름을 준비합니다.",
    icon: ListChecks,
  },
];

export default function ContestAiCheckPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--cg-green)]">
              {siteConfig.name}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.01em] sm:text-5xl">
              일러스트·디자인·그림 공모전을 위한 AI 생성 작품 확인
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-black/62">
              AI 생성 일러스트 접수 불가 조건이 있거나 AI 활용 범위를 구분해야
              하는 공모전에서는 단순 판정보다 검토 근거와 운영 이력이
              중요합니다. 진짜그림은 출품 이미지의 AI 생성 의심 여부를 작품
              단위로 관리하는 흐름을 제공합니다.
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cg-green-accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--cg-green)]"
            >
              공모전 일러스트 검사
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <Panel className="p-6">
            <h2 className="text-2xl font-semibold">운영자가 확인할 것</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-black/62">
              <p>AI 생성 일러스트 접수 가능 여부와 공모전 약관 기준</p>
              <p>출품작별 AI 생성 의심 신호와 메타데이터</p>
              <p>수상 후보작의 추가 검토 및 재검토 이력</p>
            </div>
          </Panel>
        </div>
      </PageSection>

      <PageSection className="pb-16 pt-0">
        <div className="grid gap-5 lg:grid-cols-3">
          {flows.map((flow) => (
            <Panel key={flow.title} className="p-6">
              <flow.icon className="size-7 text-[var(--cg-green)]" />
              <h2 className="mt-5 text-xl font-semibold">{flow.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black/58">
                {flow.body}
              </p>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
