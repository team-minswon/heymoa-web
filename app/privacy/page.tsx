import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description:
    "진짜그림의 개인정보 수집 항목, 이용 목적, 보관 기간, 이미지 처리, 이용자 권리에 관한 안내입니다.",
  alternates: {
    canonical: "/privacy",
  },
};

const sections = [
  {
    title: "1. 수집하는 정보",
    body: [
      "진짜그림은 서비스 제공을 위해 이메일, 프로필 이름, 소셜 로그인 식별자, 접속 기록, 기기 및 브라우저 정보, 서비스 이용 기록을 처리할 수 있습니다.",
      "이미지 검사를 위해 이용자가 업로드한 이미지 파일, 파일명, 파일 메타데이터, 검사 결과, 검토 상태, API 요청 기록을 처리할 수 있습니다.",
      "문의 접수 시 이메일 주소와 문의 내용을 처리할 수 있습니다.",
    ],
  },
  {
    title: "2. 이용 목적",
    body: [
      "회원 식별, 로그인 유지, 부정 이용 방지, 이미지 검사 제공, 검사 결과 저장 및 조회, 운영 대시보드 제공을 위해 개인정보를 이용합니다.",
      "서비스 안정성 확보, 오류 분석, 보안 사고 대응, 기능 개선, 고객 문의 처리를 위해 이용 기록을 사용할 수 있습니다.",
    ],
  },
  {
    title: "3. 이미지 처리",
    body: [
      "업로드된 이미지는 AI 생성 의심 검사, 메타데이터 분석, 국소 영역 탐지, 결과 제공을 위해 처리됩니다.",
      "MVP 또는 무료 검사에서 업로드된 원본 이미지는 서비스 정책에 따라 제한된 기간 동안 보관된 뒤 삭제될 수 있습니다.",
      "법령 준수, 보안 사고 조사, 분쟁 대응이 필요한 경우 필요한 범위에서 보관 기간이 연장될 수 있습니다.",
    ],
  },
  {
    title: "4. 보관 및 파기",
    body: [
      "개인정보는 수집 및 이용 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다.",
      "계정, 세션, API 이용 기록, 결제 또는 계약 관련 기록은 법령 또는 운영상 필요한 기간 동안 보관될 수 있습니다.",
      "전자 파일은 복구가 어렵도록 삭제하고, 출력물은 분쇄 또는 이에 준하는 방법으로 파기합니다.",
    ],
  },
  {
    title: "5. 제3자 제공 및 처리 위탁",
    body: [
      "진짜그림은 법령상 근거가 있거나 이용자의 동의가 있는 경우를 제외하고 개인정보를 외부에 판매하지 않습니다.",
      "인프라, 인증, 분석, 알림, 고객 지원 등 서비스 운영에 필요한 범위에서 외부 서비스에 처리를 위탁할 수 있습니다.",
      "외부 AI 검사 API를 사용하는 기능이 제공되는 경우, 검사에 필요한 이미지 또는 파생 데이터가 해당 제공자에게 전송될 수 있습니다.",
    ],
  },
  {
    title: "6. 이용자의 권리",
    body: [
      "이용자는 개인정보 열람, 정정, 삭제, 처리 정지, 동의 철회를 요청할 수 있습니다.",
      "권리 행사는 본인 확인 후 처리되며, 법령상 보관 의무가 있는 정보는 요청 즉시 삭제되지 않을 수 있습니다.",
    ],
  },
  {
    title: "7. 문의 및 책임자",
    body: [
      `개인정보 보호 관련 문의는 ${siteConfig.contactEmail}로 연락할 수 있습니다.`,
      "진짜그림은 문의 접수 후 합리적인 기간 내에 확인하고 필요한 조치를 안내합니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--cg-green)]">
            {siteConfig.name}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.01em]">
            개인정보 처리방침
          </h1>
          <p className="mt-4 text-sm leading-6 text-black/58">
            시행일: 2026년 6월 18일
          </p>
        </div>

        <Panel className="mt-8 p-6 sm:p-8">
          <div className="space-y-9">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-black/62">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <div className="mt-6 text-sm text-black/58">
          서비스 이용 조건은{" "}
          <Link
            href="/terms"
            className="font-semibold text-[var(--cg-green)] underline-offset-4 hover:underline"
          >
            이용약관
          </Link>
          을 확인하세요.
        </div>
      </PageSection>
    </AppShell>
  );
}
