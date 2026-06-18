import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileImage, LocateFixed, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI 일러스트 검사",
  description:
    "AI 생성 일러스트와 창작 이미지를 업로드해 메타데이터와 국소 영역 신호까지 함께 확인하는 AI 일러스트 검사 서비스입니다.",
  alternates: {
    canonical: "/ai-image-check",
  },
  keywords: [
    "AI 일러스트 검사",
    "AI 일러스트 판별",
    "AI 생성 일러스트 검사",
    "일러스트 AI 검사",
    "AI 이미지 검사",
    "AI 이미지 판별",
    "AI 그림 검사",
    "AI 생성 이미지 검사",
  ],
};

const checks = [
  {
    title: "AI 생성 의심 점수",
    body: "Midjourney, Stable Diffusion, DALL-E류 생성 이미지처럼 AI 생성 가능성이 있는 이미지를 1차로 확인합니다.",
    icon: ShieldCheck,
  },
  {
    title: "메타데이터 분석",
    body: "EXIF, XMP, PNG 텍스트, 생성 도구 흔적 등 파일에 남은 출처 신호를 함께 검토합니다.",
    icon: FileImage,
  },
  {
    title: "국소 영역 검토",
    body: "손, 눈, 배경, 패턴처럼 AI 생성 이미지에서 의심 신호가 모이는 영역을 작품 단위로 확인하는 흐름을 준비합니다.",
    icon: LocateFixed,
  },
];

export default function AiImageCheckPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--cg-green)]">
              {siteConfig.name}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.01em] sm:text-5xl">
              AI 일러스트 검사와 AI 생성 이미지 판별
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-black/62">
              진짜그림은 단순히 AI 이미지 감지기 점수만 보여주는 대신, 일러스트
              이미지의 메타데이터와 국소 영역 신호를 함께 정리해 창작 이미지의
              검토 근거를 남기는 서비스입니다.
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cg-green-accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--cg-green)]"
            >
              이미지 검사 시작
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <Panel className="p-6">
            <h2 className="text-2xl font-semibold">검사 대상</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-black/62">
              <p>AI 생성 이미지인지 확인하고 싶은 일러스트</p>
              <p>공개 전 검토가 필요한 디자인 시안과 썸네일</p>
              <p>작품 접수 후 AI 사용 의심 제보가 들어온 이미지</p>
            </div>
          </Panel>
        </div>
      </PageSection>

      <PageSection className="pb-16 pt-0">
        <div className="grid gap-5 lg:grid-cols-3">
          {checks.map((check) => (
            <Panel key={check.title} className="p-6">
              <check.icon className="size-7 text-[var(--cg-green)]" />
              <h2 className="mt-5 text-xl font-semibold">{check.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black/58">
                {check.body}
              </p>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
