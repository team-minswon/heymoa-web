import Link from "next/link";
import { ArrowRight, BellRing, Database, RadioTower } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import {
  MetricCard,
  PageSection,
  Panel,
} from "@/components/realillust/primitives";
import { UploadWorkspace } from "@/components/realillust/upload-workspace";
import { summaryCards } from "@/lib/mock-data";

const productLanes = [
  {
    title: "B2C 웹 검사기",
    body: "로그인 없이 이미지를 올리고 진행 상태와 결과 URL을 공유합니다.",
    href: "/scans/scan_9K2P1",
    icon: BellRing,
  },
  {
    title: "B2B 검사 API",
    body: "API key, tenant threshold, webhook 수신을 한 제품 흐름으로 묶습니다.",
    href: "/settings/api-keys",
    icon: RadioTower,
  },
  {
    title: "운영 대시보드",
    body: "review_required와 block 판정을 우선순위 큐로 검수합니다.",
    href: "/admin",
    icon: Database,
  },
];

export default function Home() {
  return (
    <AppShell>
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
    </AppShell>
  );
}
