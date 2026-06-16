import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import {
  DecisionBadge,
  MetricCard,
  PageSection,
  Panel,
} from "@/components/realillust/primitives";
import { scans, summaryCards } from "@/lib/mock-data";

const distribution = [
  ["allow", "54%"],
  ["label_required", "27%"],
  ["review_required", "13%"],
  ["block", "6%"],
];

export default function AdminPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.01em]">
              운영 대시보드
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">
              검사량, decision 분포, 검수 대기 항목, webhook 상태를 MVP 운영자가
              빠르게 스캔합니다.
            </p>
          </div>
          <Link
            href="/admin/review"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--cg-green-accent)] px-5 text-sm font-semibold text-white"
          >
            검수 큐 열기
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel className="p-6">
            <BarChart3 className="size-7 text-[var(--cg-green)]" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em]">
              Decision 분포
            </h2>
            <div className="mt-6 space-y-4">
              {distribution.map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm font-semibold">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full bg-[var(--cg-green)]"
                      style={{ width: value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-black/10 p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                최근 검사
              </h2>
            </div>
            <div className="divide-y divide-black/10">
              {scans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/scans/${scan.id}`}
                  className="grid gap-3 p-5 transition hover:bg-[var(--cg-cream)] sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold">{scan.fileName}</p>
                    <p className="mt-1 text-sm text-black/55">
                      {scan.tenant} · {scan.createdAt}
                    </p>
                  </div>
                  <DecisionBadge decision={scan.decision} />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </PageSection>
    </AppShell>
  );
}
