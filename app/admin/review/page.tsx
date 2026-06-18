import Link from "next/link";
import type { Metadata } from "next";
import { Check, Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/realillust/app-shell";
import {
  DecisionBadge,
  PageSection,
  Panel,
} from "@/components/realillust/primitives";
import { scans } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "검수 큐",
  robots: {
    index: false,
    follow: false,
  },
};

const reviewItems = scans.filter(
  (scan) => scan.decision === "review_required" || scan.decision === "block"
);

export default function ReviewQueuePage() {
  return (
    <AppShell>
      <PageSection>
        <h1 className="text-4xl font-semibold tracking-[-0.01em]">검수 큐</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">
          운영자는 위험 이미지와 검수 대상을 확인하고 수동 판정을 남깁니다.
        </p>

        <div className="mt-8 grid gap-5">
          {reviewItems.map((scan) => (
            <Panel key={scan.id} className="p-5">
              <div className="grid gap-5 lg:grid-cols-[140px_1fr_auto] lg:items-center">
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-[var(--cg-ceramic)] text-[var(--cg-green)]">
                  <Eye className="size-9" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{scan.fileName}</h2>
                    <DecisionBadge decision={scan.decision} />
                  </div>
                  <p className="mt-2 text-sm text-black/55">
                    {scan.id} · {scan.tenant} · AI{" "}
                    {Math.round(scan.aiScore * 100)} / NSFW{" "}
                    {Math.round(scan.nsfwScore * 100)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-black/58">
                    {scan.metadata}
                  </p>
                </div>
                <div className="flex gap-2 lg:flex-col">
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-[var(--cg-green)] px-4 text-sm font-semibold text-[var(--cg-green)]"
                  >
                    <Check data-icon="inline-start" />
                    승인
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-red-700 px-4 text-sm font-semibold text-red-700"
                  >
                    <X data-icon="inline-start" />
                    차단
                  </Button>
                  <Link
                    href={`/scans/${scan.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--cg-green-accent)] px-4 text-sm font-semibold text-white"
                  >
                    상세
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
