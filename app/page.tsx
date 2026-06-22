import type { Metadata } from "next";
import { FileSearch, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

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

const features = [
  {
    title: "AI 생성 의심 신호",
    body: "이미지 전체 점수만이 아니라 의심 영역, 파일 신호, 메타데이터를 함께 검토하는 방향으로 설계됩니다.",
    icon: Sparkles,
  },
  {
    title: "창작 이미지 검토",
    body: "일러스트와 웹툰풍 이미지처럼 단순 탐지가 어려운 창작물 검토 흐름에 맞춘 서비스를 준비하고 있습니다.",
    icon: FileSearch,
  },
  {
    title: "운영 기준 보조",
    body: "검사 결과는 확정 판정이 아니라 운영자와 창작자의 판단을 돕는 참고 자료로 제공됩니다.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageSection className="py-16 sm:py-20">
        <div className="max-w-3xl">
          <Badge variant="outline" className="border-black/10 bg-white">
            AI 일러스트 검사
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            진짜그림
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-black/62 sm:text-lg">
            AI 생성 의심 일러스트, 메타데이터, 국소 영역 신호를 함께 분석해
            창작 이미지 검토를 돕는 서비스입니다.
          </p>
        </div>
      </PageSection>

      <PageSection className="pb-16 pt-0">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <Panel key={feature.title} className="p-6">
              <feature.icon className="size-7 text-[var(--cg-green)]" />
              <h2 className="mt-5 text-xl font-semibold">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black/58">
                {feature.body}
              </p>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
