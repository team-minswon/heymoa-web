import type { Metadata } from "next";
import Link from "next/link";

import { PageSection, Panel } from "@/components/realillust/primitives";
import { StaticShell } from "@/components/realillust/static-shell";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "이용약관",
  description:
    "진짜그림 서비스 이용 조건, 계정, 이미지 검사, 결과 활용, 책임 제한에 관한 약관입니다.",
  alternates: {
    canonical: "/terms",
  },
};

const sections = [
  {
    title: "1. 목적",
    body: [
      "본 약관은 진짜그림이 제공하는 AI 일러스트 검사, AI 이미지 판별, 공모전 출품 이미지 검토 관련 서비스의 이용 조건과 절차를 정합니다.",
      "진짜그림은 AI 생성 여부를 확정하는 기관이 아니라, 이미지 검토를 돕는 보조 분석 서비스를 제공합니다.",
    ],
  },
  {
    title: "2. 서비스의 내용",
    body: [
      "이용자는 이미지를 업로드하거나 API를 통해 검사 요청을 생성할 수 있습니다.",
      "서비스는 AI 생성 의심 신호, 이미지 메타데이터, 국소 영역 분석, 운영 검토 상태 등 이미지 판단에 필요한 참고 정보를 제공할 수 있습니다.",
      "서비스의 세부 기능, 제공 범위, 이용 한도는 운영 상황과 요금제에 따라 변경될 수 있습니다.",
    ],
  },
  {
    title: "3. 이용자의 의무",
    body: [
      "이용자는 본인이 적법하게 처리할 권한이 있는 이미지만 업로드해야 합니다.",
      "타인의 개인정보, 저작권, 초상권, 영업비밀을 침해하는 이미지를 무단으로 업로드해서는 안 됩니다.",
      "서비스를 우회, 악용하거나 과도한 자동 요청으로 서비스 안정성을 해치는 행위를 해서는 안 됩니다.",
    ],
  },
  {
    title: "4. 검사 결과의 성격",
    body: [
      "AI 이미지 검사 결과는 확정 판정이 아닌 참고 자료입니다.",
      "공모전 수상 취소, 게시물 차단, 계정 제재 등 최종 조치는 각 운영자의 정책과 추가 검토에 따라 결정되어야 합니다.",
      "진짜그림은 검사 결과의 정확성, 완전성, 특정 목적 적합성을 보장하지 않습니다.",
    ],
  },
  {
    title: "5. 이미지와 데이터 처리",
    body: [
      "업로드된 이미지는 검사 제공, 오류 분석, 보안 대응, 서비스 품질 개선을 위해 필요한 범위에서 처리될 수 있습니다.",
      "이미지 보관 기간과 삭제 기준은 개인정보 처리방침 및 서비스 정책에 따릅니다.",
      "이용자는 법령 또는 계약에 따라 보존이 필요한 경우를 제외하고 이미지 삭제 또는 계정 관련 문의를 요청할 수 있습니다.",
    ],
  },
  {
    title: "6. 책임 제한",
    body: [
      "진짜그림은 무료 또는 시험 제공 기능의 중단, 변경, 오류에 대해 법령상 허용되는 범위 내에서 책임을 제한합니다.",
      "이용자가 검사 결과를 독립적인 검토 없이 단독 근거로 사용하여 발생한 분쟁에 대해서는 이용자가 책임을 부담합니다.",
    ],
  },
  {
    title: "7. 문의",
    body: [
      `서비스 이용, 약관, 계정, 데이터 처리와 관련한 문의는 ${siteConfig.contactEmail}로 연락할 수 있습니다.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <StaticShell>
      <PageSection>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--clay-brand-teal)]">
            {siteConfig.name}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.01em]">
            이용약관
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--clay-muted)]">
            시행일: 2026년 6월 18일
          </p>
        </div>

        <Panel className="mt-8 p-6 sm:p-8">
          <div className="space-y-9">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--clay-body)]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <div className="mt-6 text-sm text-[var(--clay-muted)]">
          개인정보 처리에 관한 내용은{" "}
          <Link
            href="/privacy"
            className="font-semibold text-[var(--clay-brand-teal)] underline-offset-4 hover:underline"
          >
            개인정보 처리방침
          </Link>
          을 확인하세요.
        </div>
      </PageSection>
    </StaticShell>
  );
}
