import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Database,
  FileSearch,
  RadioTower,
} from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import {
  MetricCard,
  PageSection,
  Panel,
} from "@/components/realillust/primitives";
import { UploadWorkspace } from "@/components/realillust/upload-workspace";
import { summaryCards } from "@/lib/mock-data";
import { siteConfig } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
  },
};

const productLanes = [
  {
    title: "AI 일러스트 검사",
    body: "일러스트 이미지를 업로드해 AI 생성 의심도, 메타데이터, 국소 영역 신호를 확인합니다.",
    href: "/ai-image-check",
    icon: BellRing,
  },
  {
    title: "공모전 AI 일러스트 확인",
    body: "일러스트, 디자인, 그림 공모전의 AI 생성 작품 접수 여부를 검토하는 운영 흐름입니다.",
    href: "/contest-ai-check",
    icon: RadioTower,
  },
  {
    title: "운영 대시보드",
    body: "review_required와 block 판정을 우선순위 큐로 검수합니다.",
    href: "/admin",
    icon: Database,
  },
];

const keywordSections = [
  {
    title: "AI 생성 일러스트 이미지 검사",
    body: "일러스트와 웹툰풍 이미지에서는 전체 점수만으로 판단하기 어렵습니다. 진짜그림은 AI 이미지 판별 결과와 함께 의심되는 국소 영역, 메타데이터, 파일 신호를 함께 보여주는 방향으로 설계됩니다.",
  },
  {
    title: "일러스트·디자인·그림 공모전 검토",
    body: "공모전 운영자는 AI 생성 일러스트 접수 불가, AI 활용 허용 범위, 수상작 사후 검증 같은 기준을 일관되게 적용해야 합니다. 제출 이미지를 작품 단위로 남기고 검토 상태를 관리하는 흐름을 제공합니다.",
  },
  {
    title: "AI 이미지 감지기보다 운영에 가까운 도구",
    body: "단순 AI 이미지 감지기처럼 점수만 제공하는 것이 아니라, 라벨링, 보류, 차단, 재검토 같은 후처리 의사결정에 필요한 근거를 정리하는 것을 목표로 합니다.",
  },
];

export default function Home() {
  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">
        {siteConfig.name} - AI 일러스트 검사와 AI 이미지 판별
      </h1>
      <PageSection className="pt-6">
        <UploadWorkspace />
      </PageSection>

      <PageSection className="pt-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>
      </PageSection>

      <PageSection className="pb-14">
        <div className="grid gap-5 lg:grid-cols-3">
          {productLanes.map((lane) => (
            <Panel key={lane.title} className="p-6">
              <lane.icon className="size-7 text-[var(--cg-green)]" />
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.01em]">
                {lane.title}
              </h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-black/58">
                {lane.body}
              </p>
              <Link
                href={lane.href}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--cg-green)] px-4 text-sm font-semibold text-[var(--cg-green)] transition hover:bg-[var(--cg-green)] hover:text-white"
              >
                열기
                <ArrowRight className="size-4" />
              </Link>
            </Panel>
          ))}
        </div>
      </PageSection>

      <PageSection className="pb-16 pt-0">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--cg-green)]">
              AI 일러스트 검사 키워드
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.01em]">
              창작 이미지와 공모전 운영에 맞춘 검사 흐름
            </h2>
          </div>
          <FileSearch className="hidden size-9 text-[var(--cg-green)] sm:block" />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {keywordSections.map((section) => (
            <Panel key={section.title} className="p-6">
              <h3 className="text-xl font-semibold">{section.title}</h3>
              <p className="mt-4 text-sm leading-6 text-black/58">
                {section.body}
              </p>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
